// Test-only stub for the `obsidian` module. Vitest is configured (in
// vitest.config.ts) to alias `obsidian` to this file. Production builds
// use esbuild's `external: ['obsidian']` config and never reach here.
//
// Add stub members only as tests need them. Anything not exported here
// will surface as a clear "undefined" error rather than a silent any.
import { vi } from 'vitest'

export const requestUrl = vi.fn()

/*
 Obsidian's createDiv() helper does not exist under happy-dom, so build the
 elements with the namespace-aware DOM primitive the helper wraps.
*/
function createDiv (): HTMLElement {
  return document.createElementNS('http://www.w3.org/1999/xhtml', 'div')
}

export class Notice {
  messageEl: HTMLElement
  containerEl: HTMLElement
  constructor () {
    this.messageEl = createDiv()
    this.containerEl = createDiv()
  }
}

export class Plugin {
  loadData = vi.fn(async () => ({}))
  saveData = vi.fn(async () => undefined)
}

export class PluginSettingTab {}

// `moment` is occasionally imported from obsidian (re-exported by upstream).
// Tests that touch the share() pipeline don't run, so we only need the symbol
// to exist for the import resolver.
export const moment = () => ({ format: () => '' })

// `TFile` is referenced as a value via `instanceof TFile`. Stubbed as a class
// so the runtime check returns false harmlessly for any non-TFile value.
export class TFile {}
