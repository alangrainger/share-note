import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TFile, type App } from 'obsidian'
import type API from '../api'
import { encryptString } from '../crypto'
import { DEFAULT_SETTINGS } from '../settings'
import type { SettingsStore } from '../shared/settings-store'
import { ShareService } from './share-service'
import { uploadMedia } from './upload-media'
import { captureRenderedNote } from './capture'

vi.mock('../StatusMessage', () => ({
  default: class { setStatus () {} hide () {} addLink () {} },
  StatusType: { Default: 0, Info: 1, Error: 2, Success: 3 }
}))
vi.mock('./capture', () => ({
  captureRenderedNote: vi.fn(async () => ({
    contentDom: new DOMParser().parseFromString('<p>Private note body</p>', 'text/html'),
    css: '',
    cssRules: [],
    elements: []
  }))
}))
vi.mock('./upload-media', () => ({ uploadMedia: vi.fn(async () => ({ files: [], mediaUrls: new Map() })) }))
vi.mock('./upload-css', () => ({ uploadCss: vi.fn(async () => {}) }))

function setup (frontmatter: Record<string, unknown>, enabled = true) {
  const settings = { ...DEFAULT_SETTINGS, server: 'https://self.example', apiKey: 'key', yamlField: 'pub', customSlugs: enabled, clipboard: false }
  const api = {
    checkCustomSlugSupport: vi.fn(async (_existing: boolean) => {}),
    createNote: vi.fn<API['createNote']>(async () => ({ url: 'https://self.example/my-slug', publicationId: 'fresh-id' }))
  }
  const app = {
    workspace: { getActiveFileView: () => ({ leaf: { getViewState: () => ({}), setViewState: vi.fn(async () => {}) } }) },
    metadataCache: { getFileCache: () => ({ frontmatter }) },
    fileManager: { processFrontMatter: async (_file: TFile, update: (data: Record<string, unknown>) => void) => { update(frontmatter) } }
  } as unknown as App
  const customSlugPrompt = vi.fn<() => Promise<string | undefined | null>>(async () => undefined)
  const service = new ShareService({ app, settings: { data: settings } as unknown as SettingsStore, api: api as unknown as API, saveSettings: vi.fn(), authRedirect: vi.fn(), customSlugPrompt })
  const file = Object.assign(new TFile(), { basename: 'Note', path: 'Note.md' })
  const share = (encrypted = false) => service.share(file, { encrypted, includeSource: false, forceUpload: false, forceClipboard: false })
  return { share, api, settings, customSlugPrompt }
}

beforeEach(() => vi.clearAllMocks())

describe('custom slug share pipeline', () => {
  it('prompts before capture and persists a chosen slug after publishing', async () => {
    const frontmatter: Record<string, unknown> = {}
    const { share, api, customSlugPrompt } = setup(frontmatter)
    customSlugPrompt.mockImplementationOnce(async () => {
      expect(captureRenderedNote).not.toHaveBeenCalled()
      return 'My_Project-Notes_'
    })
    api.createNote.mockResolvedValueOnce({ url: 'https://self.example/My_Project-Notes_', publicationId: 'fresh-id' })
    await share()
    expect(customSlugPrompt).toHaveBeenCalledOnce()
    expect(api.createNote).toHaveBeenCalledWith(expect.anything(), undefined, 'My_Project-Notes_', undefined)
    expect(frontmatter.pub_slug).toBe('My_Project-Notes_')
    await share()
    expect(customSlugPrompt).toHaveBeenCalledOnce()
  })

  it('uses the normal random URL request when the generated link is chosen', async () => {
    const frontmatter: Record<string, unknown> = {}
    const { share, api, customSlugPrompt } = setup(frontmatter)
    await share()
    expect(customSlugPrompt).toHaveBeenCalledOnce()
    expect(api.checkCustomSlugSupport).not.toHaveBeenCalled()
    expect(api.createNote).toHaveBeenCalledWith(expect.anything(), undefined, undefined, undefined)
    expect(frontmatter).not.toHaveProperty('pub_slug')
  })

  it('cancels without capture, uploads, or metadata writes when the prompt is dismissed', async () => {
    const frontmatter: Record<string, unknown> = {}
    const { share, api, customSlugPrompt } = setup(frontmatter)
    customSlugPrompt.mockResolvedValueOnce(null)
    await share()
    expect(captureRenderedNote).not.toHaveBeenCalled()
    expect(uploadMedia).not.toHaveBeenCalled()
    expect(api.createNote).not.toHaveBeenCalled()
    expect(frontmatter).toEqual({})
  })

  it('does not save a chosen slug if publishing fails', async () => {
    const frontmatter: Record<string, unknown> = {}
    const { share, api, customSlugPrompt } = setup(frontmatter)
    customSlugPrompt.mockResolvedValueOnce('my_notes')
    api.createNote.mockRejectedValueOnce(new Error('Slug unavailable'))
    await expect(share()).rejects.toThrow('Slug unavailable')
    expect(frontmatter).toEqual({})
  })

  it.each([
    [{ pub_slug: 'my_notes' }, true, 'https://self.example'],
    [{ pub_link: 'https://self.example/randomid' }, true, 'https://self.example'],
    [{}, false, 'https://self.example'],
    [{}, true, 'https://api.note.sx']
  ])('does not prompt when a slug or URL exists or custom slugs are unavailable', async (frontmatter, enabled, server) => {
    const { share, settings, customSlugPrompt } = setup(frontmatter, enabled)
    settings.server = server
    await share()
    expect(customSlugPrompt).not.toHaveBeenCalled()
  })

  it('reads the prefixed property and stores the server-issued identity', async () => {
    const frontmatter = { pub_slug: 'my-slug' } as Record<string, unknown>
    const { share, api } = setup(frontmatter)
    await share()
    expect(api.checkCustomSlugSupport).toHaveBeenCalledWith(false)
    expect(api.createNote).toHaveBeenCalledWith(expect.objectContaining({ encrypted: false }), undefined, 'my-slug', undefined)
    expect(frontmatter).toMatchObject({ pub_id: 'fresh-id', pub_link: 'https://self.example/my-slug' })
  })

  it('retains the full slug and encryption key while refreshing an expired publication id', async () => {
    const encrypted = await encryptString('previous content')
    const frontmatter: Record<string, unknown> = { pub_slug: 'my-slug', pub_link: `https://self.example/my-slug#${encrypted.key}`, pub_id: 'expired-id' }
    const { share, api } = setup(frontmatter)
    await share(true)
    const [payload, , slug, id] = api.createNote.mock.calls[0]
    expect(payload.filename).toBe('my-slug')
    expect(payload.encrypted).toBe(true)
    expect(payload.content).not.toContain('Private note body')
    expect(JSON.stringify(api.createNote.mock.calls)).not.toContain(encrypted.key)
    expect([slug, id]).toEqual(['my-slug', 'expired-id'])
    expect(frontmatter.pub_link).toBe(`https://self.example/my-slug#${encrypted.key}`)
    expect(frontmatter.pub_id).toBe('fresh-id')
  })

  it('keeps an existing slug when the setting or property is absent', async () => {
    const { share, api } = setup({ pub_link: 'https://self.example/my-slug', pub_id: 'active-id' }, false)
    await share()
    expect(api.checkCustomSlugSupport).toHaveBeenCalledWith(true)
    expect(api.createNote).toHaveBeenCalledWith(expect.objectContaining({ filename: 'my-slug' }), undefined, undefined, 'active-id')
  })

  it('blocks a changed slug before uploading assets or changing metadata', async () => {
    const frontmatter = { pub_slug: 'changed', pub_link: 'https://self.example/my-slug', pub_id: 'active-id' }
    const { share, api } = setup(frontmatter)
    await expect(share()).rejects.toThrow('cannot be changed')
    expect(uploadMedia).not.toHaveBeenCalled()
    expect(api.createNote).not.toHaveBeenCalled()
    expect(frontmatter.pub_id).toBe('active-id')
  })

  it('reports unsupported servers before uploading assets', async () => {
    const { share, api } = setup({ pub_slug: 'my-slug' })
    api.checkCustomSlugSupport.mockRejectedValueOnce(new Error('Upgrade server'))
    await expect(share()).rejects.toThrow('Upgrade server')
    expect(uploadMedia).not.toHaveBeenCalled()
    expect(api.createNote).not.toHaveBeenCalled()
  })

  it('ignores the property on the public server even with a stale saved opt-in', async () => {
    const { share, api, settings } = setup({ pub_slug: 'my-slug' })
    settings.server = 'https://api.note.sx/'
    await share()
    expect(api.checkCustomSlugSupport).not.toHaveBeenCalled()
    expect(api.createNote).toHaveBeenCalledWith(expect.objectContaining({ encrypted: false }), undefined, undefined, undefined)
  })
})
