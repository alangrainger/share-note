// Test-only stub for the `obsidian` module. Vitest is configured (in
// vitest.config.ts) to alias `obsidian` to this file. Production builds
// use esbuild's `external: ['obsidian']` config and never reach here.
//
// Add stub members only as tests need them. Anything not exported here
// will surface as a clear "undefined" error rather than a silent any.
/* eslint-disable obsidianmd/prefer-active-doc -- test stub, no popout concerns */
import { vi } from 'vitest'

export const requestUrl = vi.fn()

export class Notice {
  messageEl: HTMLElement
  containerEl: HTMLElement
  constructor () {
    this.messageEl = document.createElement('div')
    this.containerEl = document.createElement('div')
  }
}

export class Plugin {
  loadData = vi.fn(async () => ({}))
  saveData = vi.fn(async () => undefined)
}
