import { describe, it, expect, vi } from 'vitest'
import { uploadCss, UploadCssDeps } from './upload-css'
import { sha1 } from '../crypto'
import type API from '../api'
import type { FileUpload } from '../api'
import type StatusMessage from '../StatusMessage'

const status = { setStatus: vi.fn() } as unknown as StatusMessage

// Fake API: no attachments are queued in these tests, so processQueue is a
// no-op; upload records what would have been sent.
function makeDeps () {
  const uploaded: FileUpload[] = []
  const api = {
    queueUpload: vi.fn(async () => {}),
    processQueue: vi.fn(async () => ({ success: true, files: [] })),
    upload: vi.fn(async (data: FileUpload) => {
      uploaded.push(data)
      return 'https://files.example/x.css'
    })
  }
  const deps: UploadCssDeps = {
    api: api as unknown as API,
    recordUploadedTheme: vi.fn(async () => {})
  }
  return { api, deps, uploaded }
}

describe('uploadCss', () => {
  it('uploads the captured CSS verbatim with its hash', async () => {
    // Nesting and a range media query: syntax the old minifier silently
    // dropped (#199). Nothing may rewrite it.
    const css = '.a { color: red; & .b { color: blue; } }@media (width >= 600px) { .c { color: green; } }'
    const { deps, uploaded } = makeDeps()
    await uploadCss(css, undefined, deps, status)
    expect(uploaded).toHaveLength(1)
    expect(uploaded[0].content).toBe(css)
    expect(uploaded[0].hash).toBe(await sha1(css))
    expect(deps.recordUploadedTheme).toHaveBeenCalledTimes(1)
  })

  it('skips the upload when the server already has CSS with the same hash', async () => {
    const css = '.a { color: red; }'
    const { deps, uploaded } = makeDeps()
    const existing = { url: 'https://files.example/x.css', hash: await sha1(css) }
    await uploadCss(css, existing, deps, status, { isForceUpload: true })
    expect(uploaded).toHaveLength(0)
    expect(deps.recordUploadedTheme).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the server has CSS and no re-upload was forced', async () => {
    const { api, deps } = makeDeps()
    await uploadCss('.a { color: red; }', { url: 'https://files.example/x.css', hash: 'old' }, deps, status)
    expect(api.processQueue).not.toHaveBeenCalled()
    expect(deps.recordUploadedTheme).not.toHaveBeenCalled()
  })
})
