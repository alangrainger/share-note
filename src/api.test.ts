import { describe, it, expect, vi, beforeEach } from 'vitest'
import API from './api'
import type { SettingsStore } from './shared/settings-store'
import type { ShareSettings } from './settings'

function makeStubStore (overrides: Partial<ShareSettings> = {}): SettingsStore {
  const data: ShareSettings = {
    server: 'https://test.example',
    uid: 'test-uid',
    apiKey: 'test-api-key',
    yamlField: 'share',
    noteWidth: '',
    theme: '',
    themeMode: 0,
    titleSource: 0,
    removeYaml: true,
    removeBacklinksFooter: true,
    removeElements: '',
    expiry: '',
    clipboard: true,
    shareUnencrypted: false,
    authRedirect: null,
    debug: 0,
    ...overrides
  }
  return {
    data,
    load: vi.fn(),
    save: vi.fn()
  } as unknown as SettingsStore
}

describe('API.authHeaders', () => {
  let onUnauthenticated: () => void

  beforeEach(() => {
    onUnauthenticated = vi.fn()
  })

  it('returns the four expected sharenote headers', async () => {
    const api = new API({
      settings: makeStubStore(),
      manifestVersion: '1.5.0',
      onUnauthenticated
    })
    const headers = await api.authHeaders()
    expect(headers['x-sharenote-id']).toBe('test-uid')
    expect(headers['x-sharenote-version']).toBe('1.5.0')
    expect(headers['x-sharenote-nonce']).toMatch(/^\d+$/)
    // The signing key is sha256(nonce + apiKey) - 64 hex chars.
    expect(headers['x-sharenote-key']).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces a different signing key when the API key changes', async () => {
    const apiA = new API({
      settings: makeStubStore({ apiKey: 'key-a' }),
      manifestVersion: '1.5.0',
      onUnauthenticated
    })
    const apiB = new API({
      settings: makeStubStore({ apiKey: 'key-b' }),
      manifestVersion: '1.5.0',
      onUnauthenticated
    })
    const a = await apiA.authHeaders()
    const b = await apiB.authHeaders()
    expect(a['x-sharenote-key']).not.toBe(b['x-sharenote-key'])
  })

  it('uses the live settings via the store reference', async () => {
    // Proves that mutating the store's data after API construction is
    // reflected in subsequent calls - the API holds a live reference,
    // not a snapshot.
    const store = makeStubStore({ uid: 'first' })
    const api = new API({
      settings: store,
      manifestVersion: '1.5.0',
      onUnauthenticated
    })
    expect((await api.authHeaders())['x-sharenote-id']).toBe('first')
    store.data.uid = 'second'
    expect((await api.authHeaders())['x-sharenote-id']).toBe('second')
  })
})
