import { Plugin } from 'obsidian'
import { ShareSettings, ShareSettingsTab, DEFAULT_SETTINGS } from './settings'
import Note from './note'
import API from './api'

export default class SharePlugin extends Plugin {
  settings: ShareSettings
  api: API

  async onload () {
    await this.loadSettings()
    this.api = new API(this)

    // This adds an editor command that can perform some operation on the current editor instance
    this.addCommand({
      id: 'share',
      name: 'Share current note',
      callback: () => {
        const note = new Note(this)
        note.parse()
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
}
