/*
In this file I am creating various UI components. I'm choosing to do this from Markdown
rather than creating the components myself as HTML elements.

Two main reasons:

1. Obsidian does not provide many UI elements except for the ones used in the Settings
   page. It's up to the plugin author to create their own UI/UX. By doing it this way
   using Markdown, everything I create this way will be consistent with Obsidian's style,
   and with any theme in use.

2. Elements created this way will stay correct across any Obsidian updates. Obsidian might
   change the way a DOM object is structured, but it won't matter in this case since the
   Markdown will still be the same.

I realise this is an unusual approach to the UI problem and that it adds a performance
overhead. Time will tell if it's a good idea!
*/

import { App, Modal, Setting, Component, MarkdownRenderer } from 'obsidian'

class ConfirmDialog extends Modal {
  app: App
  onConfirm: () => void
  title?: string
  body?: string

  constructor (app: App, onConfirm: () => void) {
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
            this.onConfirm()
          }))
      .addButton(btn =>
        btn
          .setButtonText('No, cancel')
          .onClick(() => {
            this.close()
          }))
  }
}

export enum CalloutType {
  default,
  expanded,
  collapsed
}

class UIElement {
  app: App
  containerEl: HTMLDivElement

  constructor (app: App) {
    this.app = app
  }

  async renderElement (containerEl: HTMLElement, markdown: string) {
    await MarkdownRenderer.render(this.app, markdown, containerEl, '', new Component())
  }
}

class Callout extends UIElement {
  constructor (app: App, contents?: HTMLDivElement, type: CalloutType = CalloutType.expanded) {
    super(app)
    this.containerEl = document.createElement('div')
    const typeChar = type === CalloutType.expanded ? '+' : type === CalloutType.collapsed ? '-' : ''
    this.renderElement(this.containerEl, `> [!info]${typeChar} Title\n> Content`)
      .then(() => {
        if (contents) this.setContents(contents)
      })
  }

  setContents (contents: HTMLDivElement) {
    const contentEl = this.containerEl.querySelector('div.callout-content')
    if (contentEl) {
      contentEl.empty()
      contentEl.append(contents)
    }
  }
}

class Table extends UIElement {
  constructor (app: App) {
    super(app)
    this.containerEl = document.createElement('div')
    this.render().then()
  }

  async render () {
    this.containerEl.empty()
    await this.renderElement(this.containerEl, '| Col1 | Col2 |\n|---|---|\n| Some data | More data |')
  }
}

export default class UI {
  app: App
  Callout: Callout

  constructor (app: App) {
    this.app = app
  }

  confirmDialog (title = '', body = '', onConfirm: () => void) {
    const dialog = new ConfirmDialog(this.app, onConfirm)
    dialog.title = title
    dialog.body = body
    dialog.open()
    return dialog
  }

  createTable () {
    return new Table(this.app)
  }

  createCallout () {
    return new Callout(this.app)
  }
}
