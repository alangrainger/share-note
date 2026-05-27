import { Notice } from 'obsidian'

const pluginName = 'Share Note'

export enum StatusType {
  Default,
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
  [StatusType.Info]: {
    class: 'share-note-status-info',
    icon: ''
  },
  [StatusType.Success]: {
    class: 'share-note-status-success',
    icon: '✔ '
  }
}

export default class StatusMessage extends Notice {
  messageEl: HTMLDivElement
  icon: string

  constructor (text: string, type: StatusType = StatusType.Default, duration = 5000) {
    const messageDoc = new DocumentFragment()

    const icon = statuses[type]?.icon || ''
    const messageEl = messageDoc.createDiv({ text: `${icon}${pluginName}: ${text}` })
    super(messageDoc, duration)
    if (messageEl.parentElement && statuses[type]) {
      messageEl.parentElement.classList.add(statuses[type].class)
    }
    this.icon = icon
    this.messageEl = messageEl
  }

  setStatus (message: string) {
    this.messageEl.setText(`${this.icon}${pluginName}: ${message}`)
  }

  /**
   * Append a clickable link to the message on its own line.
   */
  addLink (url: string, text: string) {
    this.messageEl.createEl('br')
    this.messageEl.createEl('br')
    this.messageEl.createEl('a', { text, href: url })
  }
}
