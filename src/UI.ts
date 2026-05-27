import { App, Modal, Setting } from 'obsidian'

type ConfirmCallback = () => void | Promise<void>

class ConfirmDialog extends Modal {
  constructor (
    app: App,
    private readonly title: string,
    private readonly body: string,
    private readonly onConfirm: ConfirmCallback
  ) {
    super(app)
  }

  onOpen () {
    const { contentEl } = this
    if (this.title) contentEl.createEl('h2', { text: this.title })
    if (this.body) contentEl.createEl('p', { text: this.body })

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('🗑️ Yes, delete')
        .setCta()
        .onClick(() => {
          this.close()
          void this.onConfirm()
        }))
      .addButton(btn => btn
        .setButtonText('No, cancel')
        .onClick(() => this.close()))
  }
}

export default class UI {
  constructor (private readonly app: App) {}

  confirmDialog (title: string, body: string, onConfirm: ConfirmCallback) {
    const dialog = new ConfirmDialog(this.app, title, body, onConfirm)
    dialog.open()
    return dialog
  }
}
