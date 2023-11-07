import { Plugin, setIcon, TFile } from 'obsidian'
import { DEFAULT_SETTINGS, ShareSettings, ShareSettingsTab, YamlField } from './settings'
import Note, { SharedNote } from './note'
import API, { parseExistingShareUrl } from './api'
import StatusMessage, { StatusType } from './StatusMessage'
import { shortHash, sha256 } from './crypto'
import UI from './UI'
import NoteManagement from './NoteManagement'

export default class SharePlugin extends Plugin {
  settings: ShareSettings
  api: API
  settingsPage: ShareSettingsTab
  ui: UI

  // Expose some tools in the plugin object
  hash = shortHash
  sha256 = sha256

  async onload () {
    // Settings page
    await this.loadSettings()
    if (!this.settings.uid) {
      // Set up a random UID if the user does not already have one
      this.settings.uid = await shortHash('' + Date.now() + Math.random())
      await this.saveSettings()
    }
    if (this.settings.server === 'https://api.obsidianshare.com') {
      // Migrate to new server
      this.settings.server = 'https://api.note.sx'
      await this.saveSettings()
    }
    this.settingsPage = new ShareSettingsTab(this.app, this)
    this.addSettingTab(this.settingsPage)

    // Initialise the backend API
    this.api = new API(this)
    this.ui = new UI(this.app)

    const manage = new NoteManagement(this)
    console.log(await manage.getNotes())

    // To get an API key, we send the user to a Cloudflare Turnstile page to verify they are a human,
    // as a way to prevent abuse. The key is then sent back to Obsidian via this URI handler.
    // This way we do not require any personal data from the user like an email address.
    this.registerObsidianProtocolHandler('share-note', async (data) => {
      if (data.action === 'share-note' && data.key) {
        this.settings.apiKey = data.key
        await this.saveSettings()
        if (this.settingsPage.apikeyEl) {
          // Live-update of the settings page input field
          this.settingsPage.apikeyEl.setValue(data.key)
        }

        // Check for a redirect
        if (this.settings.authRedirect === 'share') {
          this.authRedirect(null).then()
          this.uploadNote().then()
        } else {
          // Otherwise show a success message
          new StatusMessage('Plugin successfully connected. You can now start sharing notes!', StatusType.Success, 6000)
        }
      }
    })

    // Add command - Share note
    this.addCommand({
      id: 'share-note',
      name: 'Share current note',
      callback: () => this.uploadNote()
    })

    // Add command - Share note and force a re-upload of all assets
    this.addCommand({
      id: 'force-upload',
      name: 'Force re-upload of all data for this note',
      callback: () => this.uploadNote(true)
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
          this.deleteSharedNote(sharedFile.file)
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
          this.copyShareLink(file)
        }
      }
    })

    // Add a 'Copy shared link' menu item to the 3-dot editor menu
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (file instanceof TFile && file.extension === 'md') {
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
  }

  onunload () {

  }

  async loadSettings () {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings () {
    await this.saveData(this.settings)
  }

  /**
   * Upload a note.
   * @param forceUpload - Optionally force an upload of all related assets
   * @param forceClipboard - Optionally copy the link to the clipboard, regardless of the user setting
   */
  async uploadNote (forceUpload = false, forceClipboard = false) {
    const file = this.app.workspace.getActiveFile()
    if (file instanceof TFile) {
      const meta = this.app.metadataCache.getFileCache(file)
      const note = new Note(this)

      if (this.settings.shareUnencrypted) {
        // The user has opted to share unencrypted by default
        note.shareAsPlainText(true)
      }
      if (meta?.frontmatter?.[note.field(YamlField.unencrypted)] === true) {
        // User has set the frontmatter property 'share_unencrypted` = true
        note.shareAsPlainText(true)
      }
      if (meta?.frontmatter?.[note.field(YamlField.encrypted)] === true) {
        // User has set the frontmatter property `share_encrypted` = true
        // This setting goes after the 'unencrypted' setting, just in case of conflicting checkboxes
        note.shareAsPlainText(false)
      }
      if (forceUpload) {
        note.forceUpload()
      }
      if (forceClipboard) {
        note.forceClipboard()
      }
      try {
        await note.share()
      } catch (e) {
        // Known errors are outputted by api.js
        if (e.message !== 'Known error') {
          console.log(e)
          new StatusMessage('There was an error uploading the note, please try again.', StatusType.Error)
        }
      }
      note.status.hide() // clean up status just in case
      this.addShareIcons()
    }
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

  async deleteSharedNote (file: TFile) {
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
    // I tried using onLayoutReady() here rather than a timeout/interval, but it did not work.
    // It seems that the layout is still updating even after it is "ready".
    let count = 0
    const timer = setInterval(() => {
      count++
      if (count > 8) {
        clearInterval(timer)
        return
      }
      const activeFile = this.app.workspace.getActiveFile()
      if (!activeFile) return
      const shareLink = this.app.metadataCache.getFileCache(activeFile)?.frontmatter?.[this.field(YamlField.link)]
      if (!shareLink) return
      document.querySelectorAll(`div.metadata-property[data-property-key="${this.field(YamlField.link)}"]`)
        .forEach(propertyEl => {
          const valueEl = propertyEl.querySelector('div.metadata-property-value')
          const linkEl = valueEl?.querySelector('div.external-link') as HTMLElement
          if (linkEl?.innerText !== shareLink) return
          // Remove existing elements
          // valueEl?.querySelectorAll('div.share-note-icons').forEach(el => el.remove())
          if (valueEl && !valueEl.querySelector('div.share-note-icons')) {
            const iconsEl = document.createElement('div')
            iconsEl.classList.add('share-note-icons')
            // Re-share note icon
            const shareIcon = iconsEl.createEl('span')
            shareIcon.title = 'Re-share note'
            setIcon(shareIcon, 'upload-cloud')
            shareIcon.onclick = () => this.uploadNote()
            // Copy to clipboard icon
            const copyIcon = iconsEl.createEl('span')
            copyIcon.title = 'Copy link to clipboard'
            setIcon(copyIcon, 'copy')
            copyIcon.onclick = async () => {
              await navigator.clipboard.writeText(shareLink)
              new StatusMessage('📋 Shared link copied to clipboard')
            }
            // Delete shared note icon
            const deleteIcon = iconsEl.createEl('span')
            deleteIcon.title = 'Delete shared note'
            setIcon(deleteIcon, 'trash-2')
            deleteIcon.onclick = () => this.deleteSharedNote(activeFile)
            valueEl.prepend(iconsEl)
          }
        })
    }, 50)
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

  hasSharedFile (file?: TFile) {
    if (!file) {
      file = this.app.workspace.getActiveFile() || undefined
    }
    if (file) {
      const meta = this.app.metadataCache.getFileCache(file)
      const shareLink = meta?.frontmatter?.[this.settings.yamlField + '_' + YamlField[YamlField.link]]
      if (shareLink && parseExistingShareUrl(shareLink)) {
        return {
          file,
          ...parseExistingShareUrl(shareLink)
        } as SharedNote
      }
    }
    return false
  }

  field (key: YamlField) {
    return [this.settings.yamlField, YamlField[key]].join('_')
  }
}
