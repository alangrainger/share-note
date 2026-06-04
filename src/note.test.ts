import { describe, it, expect, vi } from 'vitest'
import type { App } from 'obsidian'
import Note, { NoteDeps } from './note'
import type API from './api'
import type { SettingsStore } from './shared/settings-store'
import type { ShareSettings } from './settings'

// Minimal happy-dom stub of just what the Note constructor reaches for.
// The constructor calls `app.workspace.getActiveFileView()?.leaf`, so we
// only need that one method to exist.
function stubDeps (overrides: Partial<NoteDeps> = {}): NoteDeps {
  const settingsData: Partial<ShareSettings> = { yamlField: 'share', apiKey: 'k', expiry: '' }
  return {
    app: {
      workspace: { getActiveFileView: () => undefined }
    } as unknown as App,
    settings: { data: settingsData } as unknown as SettingsStore,
    api: {} as unknown as API,
    saveSettings: vi.fn(async () => undefined),
    authRedirect: vi.fn(async () => undefined),
    ...overrides
  }
}

describe('Note', () => {
  it('constructs from a NoteDeps stub with no SharePlugin involvement', () => {
    const note = new Note(stubDeps())
    expect(note).toBeInstanceOf(Note)
    // Default state: encryption is on, force flags are off.
    expect(note.isEncrypted).toBe(true)
    expect(note.isForceUpload).toBe(false)
    expect(note.isForceClipboard).toBe(false)
  })

  it('shareAsPlainText(true) disables encryption; (false) re-enables', () => {
    const note = new Note(stubDeps())
    note.shareAsPlainText(true)
    expect(note.isEncrypted).toBe(false)
    note.shareAsPlainText(false)
    expect(note.isEncrypted).toBe(true)
  })

  it('forceUpload() and forceClipboard() set the corresponding flags', () => {
    const note = new Note(stubDeps())
    note.forceUpload()
    note.forceClipboard()
    expect(note.isForceUpload).toBe(true)
    expect(note.isForceClipboard).toBe(true)
  })
})
