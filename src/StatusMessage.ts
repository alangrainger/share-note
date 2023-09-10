import { Notice } from 'obsidian'

const pluginName = require('../manifest.json').name

export enum StatusType {
  Info,
  Error
}

export default class StatusMessage extends Notice {
  constructor (text: string, type: StatusType = StatusType.Info, duration = 5000) {
    const messageDoc = new DocumentFragment()
    const messageEl = messageDoc.createEl('div', {
      text: pluginName + ': ' + text
    })
    super(messageDoc, duration)
    if (messageEl.parentElement) {
      const style = messageEl.parentElement.style
      if (type === StatusType.Error) {
        style.background = '#c10000'
        style.color = 'white'
      }
    }
  }
}