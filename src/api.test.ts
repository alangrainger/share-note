import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestUrl } from 'obsidian'
import API from './api'
import { AuthError, NetworkError } from './shared/errors'
import type { SettingsStore } from './shared/settings-store'
import type { ShareSettings } from './settings'

// StatusMessage relies on Obsidian's `createDiv` patch to HTMLElement, which
// happy-dom doesn't provide. The error-path tests only care about which class
// is thrown, so stub the module to a no-op constructor.
vi.mock('./StatusMessage', () => ({
  default: class { setStatus () {} },
  StatusType: { Default: 0, Info: 1, Error: 2, Success: 3 }
}))

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

describe('API.post error mapping', () => {
  const mockedRequestUrl = vi.mocked(requestUrl)
  let onUnauthenticated: () => void

  beforeEach(() => {
    mockedRequestUrl.mockReset()
    onUnauthenticated = vi.fn()
  })

  it('throws AuthError and triggers onUnauthenticated on HTTP 462', async () => {
    mockedRequestUrl.mockResolvedValue({
      status: 462,
      headers: { message: 'Invalid API key' }
    } as never)
    const api = new API({
      settings: makeStubStore(),
      manifestVersion: '1.5.0',
      onUnauthenticated
    })
    await expect(api.post('/v1/file/create-note')).rejects.toBeInstanceOf(AuthError)
    expect(onUnauthenticated).toHaveBeenCalledOnce()
  })

  it('throws a handled NetworkError when the server returns a message', async () => {
    mockedRequestUrl.mockResolvedValue({
      status: 400,
      headers: { message: 'Bad request' }
    } as never)
    const api = new API({
      settings: makeStubStore(),
      manifestVersion: '1.5.0',
      onUnauthenticated
    })
    const err = await api.post('/v1/file/create-note').catch((e: unknown) => e) as NetworkError
    expect(err).toBeInstanceOf(NetworkError)
    expect(err.handled).toBe(true)
    expect(err.status).toBe(400)
  })

  it('throws an unhandled NetworkError when the server returns no message', async () => {
    mockedRequestUrl.mockResolvedValue({
      status: 400,
      headers: {}
    } as never)
    const api = new API({
      settings: makeStubStore(),
      manifestVersion: '1.5.0',
      onUnauthenticated
    })
    const err = await api.post('/v1/file/create-note').catch((e: unknown) => e) as NetworkError
    expect(err).toBeInstanceOf(NetworkError)
    expect(err.handled).toBe(false)
  })
})
