import { Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, ShareSettings, ShareSettingsTab } from './settings'
import Note from './note'
import API from './api'
import StatusMessage, { StatusType } from './StatusMessage'

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
      if (e === 'Unknown error') {
        new StatusMessage('There was an error uploading the note, please try again.', StatusType.Error)
      }
    }
    note.status.hide() // clean up status just in case
  }
}
