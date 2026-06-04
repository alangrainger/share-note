import { App, CachedMetadata, moment, requestUrl, TFile, WorkspaceLeaf } from 'obsidian'
import { encryptString } from './crypto'
import StatusMessage, { StatusType } from './StatusMessage'
import NotePayload, { ElementStyle } from './NotePayload'
import { ThemeMode, TitleSource } from './settings'
import { buildFieldKey, YamlField } from './domain/field-keys'
import { parseExpiration } from './domain/expiration'
import API, { CheckFilesResult } from './api'
import { parseExistingShareUrl, SharedUrl } from './domain/share-link'
import { stripFrontmatter } from './pipeline/transforms/strip-frontmatter'
import { preserveFrontmatterValues } from './pipeline/transforms/preserve-frontmatter-values'
import { stripBacklinks } from './pipeline/transforms/strip-backlinks'
import { linkBacklinksToShares } from './pipeline/transforms/link-backlinks-to-shares'
import { fixCalloutIcons } from './pipeline/transforms/fix-callout-icons'
import { rewriteLinks } from './pipeline/transforms/rewrite-links'
import { removeExternalTargets } from './pipeline/transforms/remove-external-targets'
import { removeCustomSelectors } from './pipeline/transforms/remove-custom-selectors'
import { captureRenderedNote } from './pipeline/capture'
import { uploadMedia } from './pipeline/upload-media'
import { uploadCss } from './pipeline/upload-css'
import { logger } from './shared/logger'
import { SettingsStore } from './shared/settings-store'

export interface SharedNote extends SharedUrl {
  file: TFile
}

// Dependencies Note pulls in from the host plugin. Constructor-injected so
// Note can be exercised in isolation; nothing here imports `SharePlugin`.
export interface NoteDeps {
  app: App
  settings: SettingsStore
  api: API
  saveSettings: () => Promise<void>
  authRedirect: (value: string | null) => Promise<void>
}

export default class Note {
  private readonly deps: NoteDeps
  leaf: WorkspaceLeaf
  status!: StatusMessage
  css!: string
  cssRules!: CSSRule[]
  cssResult: CheckFilesResult['css']
  contentDom!: Document
  meta: CachedMetadata | null = null
  isEncrypted = true
  isForceUpload = false
  isForceClipboard = false
  elements: ElementStyle[] = []
  payload: NotePayload = {
    width: '',
    elements: [],
    encrypted: true,
    content: '',
    mathJax: false
  }

  expiration?: number

  constructor (deps: NoteDeps) {
    this.deps = deps
    // .getLeaf() doesn't return a `previewMode` property when a note is pinned,
    // so use the undocumented .getActiveFileView() which seems to work fine
    // @ts-expect-error - getActiveFileView is undocumented
    this.leaf = this.deps.app.workspace.getActiveFileView()?.leaf
  }

  private get settings () {
    return this.deps.settings.data
  }

  private field (key: YamlField): string {
    return buildFieldKey(this.settings.yamlField, key)
  }

  async share () {
    // Create a semi-permanent status notice up front so that callers can always
    // safely call note.status.hide() after share() returns or throws.
    this.status = new StatusMessage('Please do not change to another note as the current note data is still being parsed.', StatusType.Default, 60 * 1000)

    if (!this.settings.apiKey) {
      this.status.hide()
      void this.deps.authRedirect('share')
      return
    }

    const startMode = this.leaf.getViewState()
    try {
      const captured = await captureRenderedNote(this.leaf)
      this.contentDom = captured.contentDom
      this.cssRules = captured.cssRules
      this.css = captured.css
      this.elements = captured.elements
    } catch (e) {
      logger.error('Failed to parse current note:', e)
      this.status.hide()
      new StatusMessage('Failed to parse the current note', StatusType.Error)
      return
    }

    // Reset the view to the original mode. The timeout is required even
    // though we awaited the preview-mode switch inside captureRenderedNote.
    window.setTimeout(() => {
      void this.leaf.setViewState(startMode)
    }, 200)

    this.status.setStatus('Processing note...')
    const file = this.deps.app.workspace.getActiveFile()
    if (!(file instanceof TFile)) {
      // No active file
      this.status.hide()
      new StatusMessage('There is no active file to share')
      return
    }
    this.meta = this.deps.app.metadataCache.getFileCache(file)

    // Generate the HTML file for uploading

    // DOM transforms - each is a pure (doc, ctx) -> void function with tests
    // colocated in src/pipeline/transforms/.
    const linkCtx = { resolveSharedLink: (text: string) => this.resolveSharedLink(text) }

    if (this.settings.removeYaml) {
      stripFrontmatter(this.contentDom)
    } else {
      preserveFrontmatterValues(this.contentDom, this.meta?.frontmatter)
    }

    if (this.settings.removeBacklinksFooter) {
      stripBacklinks(this.contentDom)
    } else {
      linkBacklinksToShares(this.contentDom, linkCtx)
    }

    fixCalloutIcons(this.contentDom, this.cssRules)
    rewriteLinks(this.contentDom, linkCtx)
    removeExternalTargets(this.contentDom)
    removeCustomSelectors(this.contentDom, this.settings.removeElements)

    // Note options
    this.expiration = this.getExpiration()

    // Process CSS and images
    const uploadResult = await uploadMedia(
      this.contentDom,
      {
        api: this.deps.api,
        getExcalidrawSvg: async (filesource) => {
          // @ts-ignore - app.plugins is undocumented
          const excalidraw = this.deps.app.plugins.getPlugin('obsidian-excalidraw-plugin')
          if (!excalidraw) return null
          const svg = await excalidraw.ea.createSVG(filesource)
          return svg.outerHTML
        }
      },
      this.status,
      { expiration: this.expiration }
    )
    this.cssResult = uploadResult.css
    await uploadCss(
      this.css,
      this.cssResult,
      {
        api: this.deps.api,
        recordUploadedTheme: async () => {
          // @ts-ignore - app.customCss is undocumented
          this.settings.theme = this.deps.app?.customCss?.theme || ''
          await this.deps.saveSettings()
        }
      },
      this.status,
      { isForceUpload: this.isForceUpload, expiration: this.expiration }
    )

    /*
     * Encrypt the note contents
     */

    // Use previous name and key if they exist, so that links will stay consistent across updates
    let decryptionKey = ''
    if (this.meta?.frontmatter?.[this.field(YamlField.link)]) {
      const match = parseExistingShareUrl(this.meta?.frontmatter?.[this.field(YamlField.link)])
      if (match) {
        this.payload.filename = match.filename
        decryptionKey = match.decryptionKey
      }
    }
    this.payload.encrypted = this.isEncrypted

    // Select which source for the title
    let title
    switch (this.settings.titleSource) {
      case TitleSource['First H1']:
        title = this.contentDom.getElementsByTagName('h1')?.[0]?.innerText
        break
      case TitleSource['Frontmatter property']:
        title = this.meta?.frontmatter?.[this.field(YamlField.title)]
        break
    }
    if (!title) {
      // Fallback to basename if either of the above fail
      title = file.basename
    }

    if (this.isEncrypted) {
      this.status.setStatus('Encrypting note...')
      const plaintext = JSON.stringify({
        content: this.contentDom.body.innerHTML,
        basename: title
      })
      // Encrypt the note
      const encryptedData = await encryptString(plaintext, decryptionKey)
      this.payload.content = JSON.stringify({
        ciphertext: encryptedData.ciphertext,
        ivs: encryptedData.ivs
      })
      decryptionKey = encryptedData.key
    } else {
      // This is for notes shared without encryption, using the
      // share_unencrypted frontmatter property
      this.payload.content = this.contentDom.body.innerHTML
      this.payload.title = title
      // Create a meta description preview based off the <p> elements
      const desc = Array.from(this.contentDom.querySelectorAll('p'))
        .map(x => x.innerText).filter(x => !!x)
        .join(' ')
      this.payload.description = desc.length > 200 ? desc.slice(0, 197) + '...' : desc
    }

    // Make payload value replacements
    this.payload.width = this.settings.noteWidth
    // Set theme light/dark
    if (this.settings.themeMode !== ThemeMode['Same as theme']) {
      this.elements
        .filter(x => x.element === 'body')
        .forEach(item => {
          // Remove the existing theme setting
          item.classes = item.classes.filter(cls => cls !== 'theme-dark' && cls !== 'theme-light')
          // Add the preferred theme setting (dark/light)
          item.classes.push('theme-' + ThemeMode[this.settings.themeMode].toLowerCase())
        })
    }
    this.payload.elements = this.elements
    // Check for MathJax
    this.payload.mathJax = !!this.contentDom.querySelector('mjx-container')

    // Share the file
    this.status.setStatus('Uploading note...')
    let shareLink = await this.deps.api.createNote(this.payload, this.expiration)
    // Fetch the uploaded file to pull it through the CDN cache
    void requestUrl({ url: shareLink, throw: false })

    // Add the decryption key to the share link
    if (shareLink && this.isEncrypted) {
      shareLink += '#' + decryptionKey
    }

    let shareMessage = 'The note has been shared'
    if (shareLink) {
      await this.deps.app.fileManager.processFrontMatter(file, (frontmatter) => {
        // Update the frontmatter with the share link
        frontmatter[this.field(YamlField.link)] = shareLink
        frontmatter[this.field(YamlField.updated)] = moment().format()
      })
      if (this.settings.clipboard || this.isForceClipboard) {
        // Copy the share link to the clipboard
        try {
          await navigator.clipboard.writeText(shareLink)
          shareMessage = `${shareMessage} and the link is copied to your clipboard 📋`
        } catch (_e) {
          // Clipboard write fails if Obsidian window is not focused; ignore
        }
        this.isForceClipboard = false
      }
    }

    this.status.hide()
    const successMsg = new StatusMessage(shareMessage, StatusType.Success, 6000)
    if (shareLink) {
      successMsg.addLink(shareLink, '↗️ Open shared note')
    }
  }

  /**
   * Resolve an internal link target to its public shared URL, if any.
   * Used by the link-rewriting transforms; returns `undefined` if the
   * named note isn't shared or doesn't exist.
   */
  resolveSharedLink (linkText: string): string | undefined {
    try {
      const linkedFile = this.deps.app.metadataCache.getFirstLinkpathDest(linkText, '')
      if (linkedFile instanceof TFile) {
        const linkedMeta = this.deps.app.metadataCache.getFileCache(linkedFile)
        const href = linkedMeta?.frontmatter?.[this.field(YamlField.link)]
        if (typeof href === 'string') return href
      }
    } catch {
      // Best-effort lookup; on failure return undefined.
    }
    return undefined
  }

  /**
   * Get the value of a frontmatter property
   */
  getProperty (field: YamlField) {
    return this.meta?.frontmatter?.[this.field(field)]
  }

  /**
   * Force all related assets to upload again
   */
  forceUpload () {
    this.isForceUpload = true
  }

  /**
   * Copy the shared link to the clipboard, regardless of the user setting
   */
  forceClipboard () {
    this.isForceClipboard = true
  }

  /**
   * Enable/disable encryption for the note
   */
  shareAsPlainText (isPlainText: boolean) {
    this.isEncrypted = !isPlainText
  }

  /**
   * Calculate an expiry datetime from the provided expiry duration.
   * Per-note frontmatter takes precedence over the plugin-wide default.
   */
  getExpiration () {
    const input = this.getProperty(YamlField.expires) || this.settings.expiry
    return parseExpiration(input)
  }
}
