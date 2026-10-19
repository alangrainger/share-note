import { describe, it, expect, vi } from 'vitest'
import type { Plugin } from 'obsidian'
import { SettingsStore } from './settings-store'
import { DEFAULT_SETTINGS, ShareSettingsTab } from '../settings'

describe('custom slug settings', () => {
  it('defaults off for older saved settings', async () => {
    const store = new SettingsStore({ loadData: vi.fn(async () => ({})) } as unknown as Plugin)
    await store.load()
    expect(store.data.customSlugs).toBe(false)
  })
  it('clears a stale opt-in on the public server', async () => {
    const plugin = { loadData: vi.fn(async () => ({ customSlugs: true, server: 'HTTP://API.NOTE.SX/' })) } as unknown as Plugin
    const store = new SettingsStore(plugin)
    await store.load()
    expect(store.data.customSlugs).toBe(false)
  })
  it('turns off when switching back to the public server and requires re-enabling', async () => {
    const store = { data: { ...DEFAULT_SETTINGS, server: 'https://notes.example', customSlugs: true }, save: vi.fn() } as unknown as SettingsStore
    const tab = new ShareSettingsTab({} as never, {} as Plugin, store)
    await tab.setControlValue('server', 'https://api.note.sx/')
    expect(store.data.customSlugs).toBe(false)
    await tab.setControlValue('server', 'https://notes.example')
    expect(store.data.customSlugs).toBe(false)
  })
})
