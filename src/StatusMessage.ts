import { Notice } from 'obsidian'

const pluginName = require('../manifest.json').name

export enum StatusType {
  Info,
  Error,
  Success
}

interface StatusAttributes {
  class: string;
  icon: string;
}

const statuses: { [key: number]: StatusAttributes } = {
  [StatusType.Error]: {
    class: 'share-note-status-error',
    icon: '❌ '
  },
  [StatusType.Success]: {
    class: 'share-note-status-success',
    icon: '✔ '
  }
}

export default class StatusMessage extends Notice {
  constructor (text: string, type: StatusType = StatusType.Info, duration = 5000) {
    const messageDoc = new DocumentFragment()
    const icon = statuses[type]?.icon || ''
    const messageEl = messageDoc.createEl('div', {
      text: icon + pluginName + ': ' + text
    })
    super(messageDoc, duration)
    if (messageEl.parentElement) {
      if (statuses[type]) {
        messageEl.parentElement.classList.add(statuses[type].class)
      }
    }
  }
}