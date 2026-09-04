import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveFiletype, uploadMedia, UploadMediaDeps } from './upload-media'
import type API from '../api'
import type { FileUpload, UploadQueueItem } from '../api'
import type StatusMessage from '../StatusMessage'

function parseHtml (html: string): Document {
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html')
}

describe('resolveFiletype', () => {
  it('takes the extension from a vault file URL, lower-cased, ignoring the query string', () => {
    expect(resolveFiletype('app://obsidian.md/vault/Pics/Photo.JPG?1712345', null)).toBe('jpg')
  })

  it('falls back to the Content-Type for a blob URL', () => {
    expect(resolveFiletype('blob:app://obsidian.md/4c9e-1a2b', 'image/svg+xml')).toBe('svg')
  })

  it('falls back to the Content-Type for a data URL', () => {
    expect(resolveFiletype('data:image/png;base64,iVBORw0KGgo=', 'image/png')).toBe('png')
  })

  it('ignores Content-Type parameters', () => {
    expect(resolveFiletype('blob:app://obsidian.md/x', 'image/svg+xml; charset=utf-8')).toBe('svg')
  })

  it('returns undefined when neither the path nor the Content-Type gives a known type', () => {
    expect(resolveFiletype('app://obsidian.md/vault/no-extension', 'application/octet-stream')).toBeUndefined()
    expect(resolveFiletype('blob:app://obsidian.md/x', null)).toBeUndefined()
    expect(resolveFiletype('not a url', 'image/png')).toBeUndefined()
  })
})

describe('uploadMedia', () => {
  const status = { setStatus: vi.fn() } as unknown as StatusMessage

  // Fake API: records what was queued and resolves each upload immediately.
  function makeDeps () {
    const queued: FileUpload[] = []
    const api = {
      queueUpload: vi.fn(async (item: UploadQueueItem) => {
        queued.push(item.data)
        item.callback(`https://files.example/${item.data.hash}.${item.data.filetype}`)
      }),
      processQueue: vi.fn(async () => ({ success: true, files: [] }))
    }
    const deps: UploadMediaDeps = {
      api: api as unknown as API,
      getExcalidrawSvg: vi.fn(async () => null)
    }
    return { deps, queued }
  }

  function mockFetch (body: string, contentType: string) {
    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(body, { status: 200, headers: { 'content-type': contentType } })
    )
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uploads a blob: image using the Content-Type the fetch reports', async () => {
    mockFetch('<svg/>', 'image/svg+xml')
    const doc = parseHtml('<img class="code-styler-icon" src="blob:app://obsidian.md/4c9e-1a2b">')
    const { deps, queued } = makeDeps()
    await uploadMedia(doc, deps, status)
    expect(queued).toHaveLength(1)
    expect(queued[0].filetype).toBe('svg')
    expect(doc.querySelector('img')?.getAttribute('src')).toMatch(/^https:\/\/files\.example\/[0-9a-f]+\.svg$/)
  })

  it('leaves an asset alone when its type cannot be determined', async () => {
    mockFetch('?', 'application/octet-stream')
    const doc = parseHtml('<img src="blob:app://obsidian.md/unknown">')
    const { deps, queued } = makeDeps()
    await uploadMedia(doc, deps, status)
    expect(queued).toHaveLength(0)
    expect(doc.querySelector('img')?.getAttribute('src')).toBe('blob:app://obsidian.md/unknown')
  })
})
