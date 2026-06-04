import { describe, it, expect, vi } from 'vitest'
import type { App } from 'obsidian'
import { ShareService, ShareServiceDeps } from './share-service'
import type API from '../api'
import type { SettingsStore } from '../shared/settings-store'
import type { ShareSettings } from '../settings'

function stubDeps (overrides: Partial<ShareServiceDeps> = {}): ShareServiceDeps {
  const settingsData: Partial<ShareSettings> = { yamlField: 'share', apiKey: 'k', expiry: '' }
  return {
    app: {} as unknown as App,
    settings: { data: settingsData } as unknown as SettingsStore,
    api: {} as unknown as API,
    saveSettings: vi.fn(async () => undefined),
    authRedirect: vi.fn(async () => undefined),
    ...overrides
  }
}

describe('ShareService', () => {
  it('constructs from a ShareServiceDeps stub with no SharePlugin involvement', () => {
    const service = new ShareService(stubDeps())
    expect(service).toBeInstanceOf(ShareService)
  })
})
