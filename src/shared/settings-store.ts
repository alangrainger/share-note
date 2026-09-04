import { Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, ShareSettings } from '../settings'

/**
 * Wraps Obsidian's plugin data persistence and exposes the current settings
 * as a mutable object. Centralising the load/save behind a single object lets
 * modules depend on the settings store instead of the whole plugin.
 *
 * Usage:
 *   const store = new SettingsStore(plugin)
 *   await store.load()
 *   store.data.apiKey = 'xyz'
 *   await store.save()
 */
export class SettingsStore {
  data!: ShareSettings

  constructor (private readonly plugin: Plugin) {}

  async load (): Promise<void> {
    const stored = (await this.plugin.loadData()) as Partial<ShareSettings> | null
    this.data = { ...DEFAULT_SETTINGS, ...stored }
  }

  async save (): Promise<void> {
    await this.plugin.saveData(this.data)
  }
}
