/*
In this file I am creating various UI components. I'm choosing to do this _from Markdown_,
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

import { Component, MarkdownRenderer } from 'obsidian'

async function renderElement (containerEl: HTMLElement, markdown: string) {
  // @ts-ignore - I haven't imported `app`, but it doesn't seem to have any ill effects
  await MarkdownRenderer.render(null, markdown, containerEl, '', new Component()).then()
}

export enum CalloutType {
  default,
  expanded,
  collapsed
}

class Callout {
  containerEl: HTMLDivElement

  constructor (contents?: HTMLDivElement, type: CalloutType = CalloutType.expanded) {
    this.containerEl = document.createElement('div')
    const typeChar = type === CalloutType.expanded ? '+' : type === CalloutType.collapsed ? '-' : ''
    renderElement(this.containerEl, `> [!info]${typeChar} Title\n> Content`)
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

class Table {
  containerEl: HTMLDivElement

  constructor () {
    this.containerEl = document.createElement('div')
    this.render().then()
  }

  async render () {
    this.containerEl.empty()
    // renderElement(this.containerEl, '| Col1 | Col2 |\n|---|---|\n| Some data | More data |')
    await renderElement(this.containerEl, 'sdfg sdfg ')
  }
}

export default {
  Callout,
  Table
}
