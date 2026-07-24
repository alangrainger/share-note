import { Plugin, setIcon, TFile } from 'obsidian'
import { ShareSettings, ShareSettingsTab } from './settings'
import API from './api'
import { parseExistingShareUrl, SharedNote } from './domain/share-link'
import { buildFieldKey, buildFieldKeys, YamlField } from './domain/field-keys'
import { resolveEncryption } from './domain/encryption-policy'
import StatusMessage, { StatusType } from './StatusMessage'
import { shortHash, sha256 } from './crypto'
import { SettingsStore } from './shared/settings-store'
import { ShareError } from './shared/errors'
import { logger } from './shared/logger'
import { ShareService } from './pipeline/share-service'
import UI from './UI'

export default class SharePlugin extends Plugin {
  declare settings: ShareSettings
  settingsStore!: SettingsStore
  api!: API
  settingsPage!: ShareSettingsTab
  shareService!: ShareService
  ui!: UI

  // Expose some tools in the plugin object
  hash = shortHash
  sha256 = sha256

  async onload () {
    // Settings store: single source of truth for persistence. We also alias
    // `this.settings` to the store's data so existing call sites of the form
    // `this.plugin.settings.xxx` continue to work - it's the same object.
    this.settingsStore = new SettingsStore(this)
    await this.settingsStore.load()
    this.settings = this.settingsStore.data
    if (!this.settings.uid) {
      // Set up a random UID if the user does not already have one
      this.settings.uid = await shortHash(`${Date.now()}-${Math.random()}`)
      await this.saveSettings()
    }
    this.settingsPage = new ShareSettingsTab(this.app, this, this.settingsStore)
    this.addSettingTab(this.settingsPage)

    // Initialise the backend API
    this.api = new API({
      settings: this.settingsStore,
      manifestVersion: this.manifest.version,
      onUnauthenticated: () => { void this.authRedirect('share') }
    })
    this.shareService = new ShareService({
      app: this.app,
      settings: this.settingsStore,
      api: this.api,
      saveSettings: () => this.saveSettings(),
      authRedirect: (v) => this.authRedirect(v)
    })
    this.ui = new UI(this.app)

    // To get an API key, we send the user to a Cloudflare Turnstile page to verify they are a human,
    // as a way to prevent abuse. The key is then sent back to Obsidian via this URI handler.
    // This way we do not require any personal data from the user like an email address.
    this.registerObsidianProtocolHandler('share-note', async (data) => {
      if (data.action === 'share-note' && data.key) {
        this.settings.apiKey = data.key
        await this.saveSettings()
        // Live-update of the settings page input field (if it's been rendered)
        this.settingsPage.apikeyEl?.setValue(data.key)

        // Check for a redirect
        if (this.settings.authRedirect === 'share') {
          void this.authRedirect(null)
          void this.uploadNote()
        } else {
          // Otherwise show a success message
          new StatusMessage('Plugin successfully connected. You can now start sharing notes!', StatusType.Success, 6000)
        }
      }
    })

    // Add command - Share note
    this.addCommand({
      id: 'share',
      name: 'Share current note',
      callback: () => { void this.uploadNote() }
    })

    // Add command - Share note and force a re-upload of all assets
    this.addCommand({
      id: 'force-upload',
      name: 'Force re-upload of all data for this note',
      callback: () => { void this.uploadNote(true) }
    })

    // Add command - Delete shared note
    this.addCommand({
      id: 'delete-note',
      name: 'Delete this shared note',
      checkCallback: (checking: boolean) => {
        const sharedFile = this.hasSharedFile()
        if (checking) {
          return !!sharedFile
        } else if (sharedFile) {
          void this.deleteSharedNote(sharedFile.file)
        }
      }
    })

    // Add command - Copy shared link
    this.addCommand({
      id: 'copy-link',
      name: 'Copy shared note link',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile()
        if (checking) {
          return file instanceof TFile
        } else if (file) {
          void this.copyShareLink(file)
        }
      }
    })

    // Add a menu item to the 3-dot editor menu
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (file instanceof TFile && file.extension === 'md') {
          menu.addItem((item) => {
            item.setIcon('globe')
            item.setTitle('Share note on the web')
            item.onClick(() => { void this.uploadNote() })
          })
          menu.addItem((item) => {
            item.setIcon('share-2')
            item.setTitle('Copy shared link')
            item.onClick(async () => {
              await this.copyShareLink(file)
            })
          })
        }
      })
    )

    // Add share icons to properties panel
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
      this.addShareIcons()
    }))
    // Properties can re-render without a leaf change (frontmatter edit, mode
    // switch, delayed metadata). Re-inject when the active file's cache updates.
    this.registerEvent(this.app.metadataCache.on('changed', (file) => {
      if (file === this.app.workspace.getActiveFile()) this.addShareIcons()
    }))
    this.registerEvent(this.app.workspace.on('layout-change', () => {
      this.addShareIcons()
    }))
  }

  onunload () {

  }

  async saveSettings () {
    await this.settingsStore.save()
  }

  /**
   * Upload a note.
   * @param forceUpload - Optionally force an upload of all related assets
   * @param forceClipboard - Optionally copy the link to the clipboard, regardless of the user setting
   */
  async uploadNote (forceUpload = false, forceClipboard = false) {
    const file = this.app.workspace.getActiveFile()
    if (!(file instanceof TFile)) return
    const meta = this.app.metadataCache.getFileCache(file)
    const fieldKeys = buildFieldKeys(this.settings.yamlField)
    const encrypted = resolveEncryption({
      defaultUnencrypted: this.settings.shareUnencrypted,
      frontmatter: meta?.frontmatter,
      unencryptedKey: fieldKeys.unencrypted,
      encryptedKey: fieldKeys.encrypted
    })

    try {
      await this.shareService.share(file, { encrypted, forceUpload, forceClipboard })
    } catch (e) {
      // `handled` means the throw site already surfaced a user-facing message
      if (!(e instanceof ShareError && e.handled)) {
        logger.error('Upload failed:', e)
        new StatusMessage('There was an error uploading the note, please try again.', StatusType.Error)
      }
    }
    this.addShareIcons()
  }

  /**
   * Copy the share link to the clipboard. The note will be shared first if neccessary.
   * @param file
   */
  async copyShareLink (file: TFile): Promise<string | undefined> {
    const meta = this.app.metadataCache.getFileCache(file)
    const shareLink = meta?.frontmatter?.[this.settings.yamlField + '_' + YamlField[YamlField.link]]
    if (shareLink) {
      // The note is already shared, copy the link to the clipboard
      await navigator.clipboard.writeText(shareLink)
      new StatusMessage('📋 Shared link copied to clipboard')
    } else {
      // The note is not already shared, share it first and copy the link to the clipboard
      await this.uploadNote(false, true)
    }
    return shareLink
  }

  deleteSharedNote (file: TFile) {
    const sharedFile = this.hasSharedFile(file)
    if (sharedFile) {
      this.ui.confirmDialog(
        'Delete shared note?',
        'Are you sure you want to delete this shared note and the shared link? This will not delete your local note.',
        async () => {
          new StatusMessage('Deleting note...')
          await this.api.deleteSharedNote(sharedFile.url)
          await this.app.fileManager.processFrontMatter(sharedFile.file, (frontmatter) => {
            // Remove the shared link
            delete frontmatter[this.field(YamlField.link)]
            delete frontmatter[this.field(YamlField.updated)]
          })
        })
    }
  }

  addShareIcons () {
    const activeFile = this.app.workspace.getActiveFile()
    if (!activeFile) return
    const fieldKey = this.field(YamlField.link)
    const shareLink = this.app.metadataCache.getFileCache(activeFile)?.frontmatter?.[fieldKey]
    if (typeof shareLink !== 'string' || !shareLink) return

    // Try to inject; returns true once the icons are in place. We attempt
    // immediately (the panel may already be rendered after a re-focus) and
    // then watch the active document for DOM changes - Obsidian renders the
    // properties panel asynchronously after a leaf change.
    const inject = () => this.tryInjectShareIcons(activeFile, fieldKey, shareLink)
    if (inject()) return

    const observer = new MutationObserver(() => {
      if (inject()) observer.disconnect()
    })
    observer.observe(activeDocument.body, { childList: true, subtree: true })
    // Safety: stop watching after a few seconds even if the panel never appears
    // (e.g. user navigated away, or properties are collapsed).
    window.setTimeout(() => observer.disconnect(), 5000)
  }

  /**
   * Decide whether a properties-panel value cell currently represents the
   * shared URL. Newer Obsidian versions no longer reliably render this as
   * `div.external-link` with exact innerText, so we accept several shapes.
   */
  private propertyValueMatchesShareLink (valueEl: Element, shareLink: string): boolean {
    const normalized = shareLink.trim()
    const candidates: string[] = []

    valueEl.querySelectorAll('div.external-link, a.external-link, a').forEach((el) => {
      const textContent = (el.textContent || '').trim()
      if (textContent) candidates.push(textContent)
      const href = el.getAttribute('href')?.trim()
      if (href) candidates.push(href)
    })

    valueEl.querySelectorAll('input').forEach((el) => {
      const value = String((el as unknown as { value?: string }).value || '').trim()
      if (value) candidates.push(value)
    })

    // Some themes/renderers put the URL directly on the value container.
    const direct = (valueEl.textContent || '').trim()
    if (direct) candidates.push(direct)

    return candidates.some((c) => c === normalized || c.startsWith(normalized.split('#')[0]))
  }

  private tryInjectShareIcons (activeFile: TFile, fieldKey: string, shareLink: string): boolean {
    let injected = false
    activeDocument.querySelectorAll(`div.metadata-property[data-property-key="${fieldKey}"]`)
      .forEach(propertyEl => {
        const valueEl = propertyEl.querySelector('div.metadata-property-value')
        if (!valueEl || valueEl.querySelector('div.share-note-icons')) return

        // `data-property-key` already identifies the share_link row. Do not
        // require a brittle `div.external-link` exact text match - newer
        // Obsidian builds render URL properties as anchors/inputs/plain text.
        // If a value is present and clearly not our link, skip; otherwise inject.
        const hasAnyValue = !!(valueEl.textContent || '').trim() || !!valueEl.querySelector('input, a, div.external-link')
        if (hasAnyValue && !this.propertyValueMatchesShareLink(valueEl, shareLink)) {
          // Still allow injection when the row is our property key and the
          // displayed text is only the URL without hash, icons, etc. The
          // matcher already accepts base-URL prefixes; if it still fails the
          // property is showing unrelated content.
          return
        }

        const iconsEl = createDiv({ cls: 'share-note-icons' })

        const shareBtn = iconsEl.createSpan({ attr: { title: 'Update / re-share note', 'aria-label': 'Update shared note' } })
        setIcon(shareBtn, 'upload-cloud')
        this.registerDomEvent(shareBtn, 'click', (evt) => {
          evt.preventDefault()
          evt.stopPropagation()
          void this.uploadNote()
        })

        const copyBtn = iconsEl.createSpan({ attr: { title: 'Copy link to clipboard', 'aria-label': 'Copy shared link' } })
        setIcon(copyBtn, 'copy')
        this.registerDomEvent(copyBtn, 'click', async (evt) => {
          evt.preventDefault()
          evt.stopPropagation()
          await navigator.clipboard.writeText(shareLink)
          new StatusMessage('📋 Shared link copied to clipboard')
        })

        const deleteBtn = iconsEl.createSpan({ attr: { title: 'Delete shared note', 'aria-label': 'Delete shared note' } })
        setIcon(deleteBtn, 'trash-2')
        this.registerDomEvent(deleteBtn, 'click', (evt) => {
          evt.preventDefault()
          evt.stopPropagation()
          void this.deleteSharedNote(activeFile)
        })

        valueEl.prepend(iconsEl)
        injected = true
      })
    return injected
  }

  /**
   * Redirect a user back to their position in the flow after they finish the auth.
   * NULL to clear the redirection.
   */
  async authRedirect (value: string | null) {
    this.settings.authRedirect = value
    await this.saveSettings()
    if (value) window.open(this.settings.server + '/v1/account/get-key?id=' + this.settings.uid)
  }

  hasSharedFile (file?: TFile): SharedNote | null {
    const target = file ?? this.app.workspace.getActiveFile()
    if (!target) return null
    const meta = this.app.metadataCache.getFileCache(target)
    const shareLink = meta?.frontmatter?.[this.field(YamlField.link)]
    if (typeof shareLink !== 'string') return null
    const parsed = parseExistingShareUrl(shareLink)
    if (!parsed) return null
    return { file: target, ...parsed }
  }

  field (key: YamlField) {
    return buildFieldKey(this.settings.yamlField, key)
  }
}
