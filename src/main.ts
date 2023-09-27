import { Plugin, TFile } from 'obsidian'
import { DEFAULT_SETTINGS, ShareSettings, ShareSettingsTab } from './settings'
import Note, { YamlField } from './note'
import API from './api'
import StatusMessage, { StatusType } from './StatusMessage'
import { hash, sha256 } from './crypto'

export default class SharePlugin extends Plugin {
  settings: ShareSettings
  api: API
  settingsPage: ShareSettingsTab

  // Expose some tools in the plugin object
  hash = hash
  sha256 = sha256

  async onload () {
    // Settings page
    await this.loadSettings()
    if (!this.settings.uid) {
      // Set up a random UID if the user does not already have one
      this.settings.uid = await hash('' + Date.now() + Math.random())
      await this.saveSettings()
    }
    this.settingsPage = new ShareSettingsTab(this.app, this)
    this.addSettingTab(this.settingsPage)

    // Initialise the backend API
    this.api = new API(this)

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
        new StatusMessage('Plugin successfully connected. You can now start sharing notes!', StatusType.Success, 6000)
      }
    })

    // Add command - Share note
    this.addCommand({
      id: 'share-note',
      name: 'Share current note',
      callback: async () => {
        await this.uploadNote()
      }
    })

    // Add command - Share note and force a re-upload of all assets
    this.addCommand({
      id: 'force-upload',
      name: 'Force re-upload of all data for this note',
      callback: async () => {
        await this.uploadNote(true)
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

      // Check for a frontmatter property called 'share_unencrypted` = true
      // otherwise the default is to share encrypted
      if (meta?.frontmatter?.[note.field(YamlField.unencrypted)] === true) {
        note.shareAsPlainText(true)
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
        if (e.message === 'Unknown error') {
          console.log(e)
          new StatusMessage('There was an error uploading the note, please try again.', StatusType.Error)
        }
      }
      note.status.hide() // clean up status just in case
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
}
