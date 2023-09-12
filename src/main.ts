import { Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, ShareSettings, ShareSettingsTab } from './settings'
import Note from './note'
import API from './api'
import StatusMessage, { StatusType } from './StatusMessage'
import { hash } from './crypto'

export default class SharePlugin extends Plugin {
  settings: ShareSettings
  api: API
  settingsPage: ShareSettingsTab

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
      if (data.action === 'share-note' && data.key && this.settingsPage.apikeyEl) {
        this.settings.apiKey = data.key
        await this.saveSettings()
        this.settingsPage.apikeyEl.setValue(data.key)
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
  }

  onunload () {

  }

  async loadSettings () {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings () {
    await this.saveData(this.settings)
  }

  async uploadNote (forceUpload = false) {
    const note = new Note(this)
    if (forceUpload) {
      note.forceUpload()
    }
    try {
      await note.parse()
    } catch (e) {
      if (e.message === 'Unknown error') {
        new StatusMessage('There was an error uploading the note, please try again.', StatusType.Error)
      }
    }
    note.status.hide() // clean up status just in case
  }
}
