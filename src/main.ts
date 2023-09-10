import { Notice, Plugin } from 'obsidian'
import { ShareSettings, ShareSettingsTab, DEFAULT_SETTINGS } from './settings'
import Note from './note'
import API from './api'

export default class SharePlugin extends Plugin {
  settings: ShareSettings
  api: API

  async onload () {
    await this.loadSettings()
    this.api = new API(this)

    // Share note
    this.addCommand({
      id: 'share-note',
      name: 'Share current note',
      callback: async () => {
        await this.uploadNote()
      }
    })

    // Share note and force a re-upload of all assets
    this.addCommand({
      id: 'force-upload',
      name: 'Force re-upload of all data for this note',
      callback: async () => {
        await this.uploadNote(true)
      }
    })

    this.addSettingTab(new ShareSettingsTab(this.app, this))
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
      new Notice('There was an error uploading the note, please try again.', 5000)
    }
    note.status.hide() // clean up status just in case
  }
}
