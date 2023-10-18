import { Component, MarkdownRenderer } from 'obsidian'

export class Callout {
  containerEl: HTMLDivElement

  constructor (contents?: HTMLDivElement) {
    this.containerEl = document.createElement('div')
    // @ts-ignore
    MarkdownRenderer.render(null, '> [!info]- Title\n> Content', this.containerEl, '', new Component()).then()
    if (contents) {
      this.setContents(contents)
    }
  }

  setContents (contents: HTMLDivElement) {
    const contentEl = this.containerEl.querySelector('div.callout-content')
    if (contentEl) {
      contentEl.empty()
      contentEl.append(contents)
    }
  }
}

export default {
  Callout
}
