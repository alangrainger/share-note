import { App, Modal, Setting } from 'obsidian'

class ConfirmDialog extends Modal {
  app: App
  onConfirm: () => void | Promise<void>
  title?: string
  body?: string

  constructor (app: App, onConfirm: () => void | Promise<void>) {
    super(app)
    this.onConfirm = onConfirm
  }

  onOpen () {
    const { contentEl } = this

    if (this.title) {
      contentEl.createEl('h2', { text: this.title })
    }
    if (this.body) {
      contentEl.createEl('p', { text: this.body })
    }

    new Setting(contentEl)
      .addButton(btn =>
        btn
          .setButtonText('🗑️ Yes, delete')
          .setCta()
          .onClick(() => {
            this.close()
            void this.onConfirm()
          }))
      .addButton(btn =>
        btn
          .setButtonText('No, cancel')
          .onClick(() => {
            this.close()
          }))
  }
}

export default class UI {
  app: App

  constructor (app: App) {
    this.app = app
  }

  confirmDialog (title = '', body = '', onConfirm: () => void | Promise<void>) {
    const dialog = new ConfirmDialog(this.app, onConfirm)
    dialog.title = title
    dialog.body = body
    dialog.open()
    return dialog
  }
}
