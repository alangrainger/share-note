import {Setting } from 'obsidian'
import SharePlugin from './main'
import UI from './UI'

export default class NoteManagement {
  plugin: SharePlugin
  containerEl: HTMLDivElement

  constructor (plugin: SharePlugin) {
    this.plugin = plugin
    this.containerEl = document.createElement('div')

    new Setting(this.containerEl)
      .setName('Test')
      .setDesc('Test description')

    const calloutEl = document.createElement('div')
    calloutEl.classList.add('callout', 'is-collapsible')
    const titleEl = document.createElement('div')
    titleEl.classList.add('callout-title')
    titleEl.innerText = 'Test title'
    calloutEl.append(titleEl)

    const contents = document.createElement('div')
    contents.innerHTML = '<p>asdf asdf asdf</p>'

    this.containerEl.append((new UI.Callout(contents)).containerEl)
  }
}