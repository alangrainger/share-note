import { Notice } from 'obsidian'

const pluginName = require('../manifest.json').name

export enum StatusType {
  Info,
  Error,
  Success
}

interface StatusAttributes {
  background: string;
  color: string;
  icon: string;
}

const statuses: { [key: number]: StatusAttributes } = {
  [StatusType.Error]: {
    background: '#c10000',
    color: 'white',
    icon: '❌ '
  },
  [StatusType.Success]: {
    background: '#4c864c',
    color: 'white',
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
      const style = messageEl.parentElement.style
      if (statuses[type]) {
        style.background = statuses[type].background
        style.color = statuses[type].color
      }
    }
  }
}