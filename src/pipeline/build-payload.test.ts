import { describe, it, expect } from 'vitest'
import { buildPayload, BuildPayloadInput } from './build-payload'
import { ThemeMode, TitleSource } from '../settings'
import StatusMessage from '../StatusMessage'

// Minimal status stub - buildPayload only calls setStatus, and only on the
// encrypted branch ("Encrypting note...").
const noopStatus = { setStatus () {} } as unknown as StatusMessage

function makeDom (html: string): Document {
  return new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, 'text/html')
}

function baseInput (overrides: Partial<BuildPayloadInput> = {}): BuildPayloadInput {
  return {
    contentDom: makeDom('<p>Hello world</p>'),
    elements: [],
    frontmatter: undefined,
    fallbackTitle: 'note-basename',
    previousShare: undefined,
    titleFrontmatterKey: 'share_title',
    isEncrypted: false,
    titleSource: TitleSource['Note title'],
    noteWidth: '',
    themeMode: ThemeMode['Same as theme'],
    ...overrides
  }
}

describe('buildPayload (plaintext branch)', () => {
  it('puts the rendered body HTML directly into payload.content', async () => {
    const dom = makeDom('<h1>Heading</h1><p>Body text.</p>')
    const { payload, decryptionKey } = await buildPayload(
      baseInput({ contentDom: dom }),
      noopStatus
    )
    expect(payload.encrypted).toBe(false)
    expect(payload.content).toContain('<h1>Heading</h1>')
    expect(payload.content).toContain('<p>Body text.</p>')
    expect(decryptionKey).toBe('')
  })

  it('falls back to fallbackTitle when no configured source resolves', async () => {
    const dom = makeDom('<p>No heading here.</p>')
    const { payload } = await buildPayload(
      baseInput({ contentDom: dom, titleSource: TitleSource['First H1'] }),
      noopStatus
    )
    expect(payload.title).toBe('note-basename')
  })

  it('uses the First H1 when that source is selected', async () => {
    const dom = makeDom('<h1>First Heading</h1><p>Body.</p>')
    const { payload } = await buildPayload(
      baseInput({ contentDom: dom, titleSource: TitleSource['First H1'] }),
      noopStatus
    )
    expect(payload.title).toBe('First Heading')
  })

  it('uses a frontmatter property when that source is selected', async () => {
    const { payload } = await buildPayload(
      baseInput({
        titleSource: TitleSource['Frontmatter property'],
        titleFrontmatterKey: 'share_title',
        frontmatter: { share_title: 'From frontmatter' }
      }),
      noopStatus
    )
    expect(payload.title).toBe('From frontmatter')
  })

  it('truncates the description at 200 chars with an ellipsis', async () => {
    const long = 'x'.repeat(500)
    const dom = makeDom(`<p>${long}</p>`)
    const { payload } = await buildPayload(
      baseInput({ contentDom: dom }),
      noopStatus
    )
    expect(payload.description?.length).toBe(200)
    expect(payload.description?.endsWith('...')).toBe(true)
  })

  it('detects MathJax via mjx-container', async () => {
    const dom = makeDom('<mjx-container>x</mjx-container>')
    const { payload } = await buildPayload(
      baseInput({ contentDom: dom }),
      noopStatus
    )
    expect(payload.mathJax).toBe(true)
  })
})

describe('buildPayload (encrypted branch)', () => {
  it('encrypts the content and returns a fresh decryption key', async () => {
    const dom = makeDom('<p>Secret.</p>')
    const { payload, decryptionKey } = await buildPayload(
      baseInput({ contentDom: dom, isEncrypted: true }),
      noopStatus
    )
    expect(payload.encrypted).toBe(true)
    // payload.content is a JSON string containing ciphertext + ivs arrays.
    const parsed = JSON.parse(payload.content)
    expect(Array.isArray(parsed.ciphertext)).toBe(true)
    expect(Array.isArray(parsed.ivs)).toBe(true)
    expect(parsed.ciphertext.length).toBeGreaterThan(0)
    expect(parsed.ivs.length).toBe(parsed.ciphertext.length)
    expect(decryptionKey).not.toBe('')
    // Plaintext-only fields stay unset.
    expect(payload.title).toBeUndefined()
    expect(payload.description).toBeUndefined()
  })

  it('reuses the previous share filename and decryption key when re-sharing', async () => {
    // Generate a real AES key by running a throwaway encryption first.
    // Fabricating a key string would fail importKey's length validation.
    const seed = await buildPayload(baseInput({ isEncrypted: true }), noopStatus)
    const previousShare = { filename: 'abc.html', decryptionKey: seed.decryptionKey }
    const { payload, decryptionKey } = await buildPayload(
      baseInput({ isEncrypted: true, previousShare }),
      noopStatus
    )
    expect(payload.filename).toBe('abc.html')
    expect(decryptionKey).toBe(previousShare.decryptionKey)
  })
})

describe('buildPayload theme override', () => {
  it('swaps theme-light for theme-dark on the body element', () => {
    const elements = [
      { element: 'body', classes: ['some-other', 'theme-light'], style: '' }
    ]
    return buildPayload(
      baseInput({ elements, themeMode: ThemeMode.Dark }),
      noopStatus
    ).then(({ payload }) => {
      const body = payload.elements.find(e => e.element === 'body')
      expect(body?.classes).toContain('theme-dark')
      expect(body?.classes).not.toContain('theme-light')
      expect(body?.classes).toContain('some-other')
    })
  })

  it('leaves classes untouched when themeMode is "Same as theme"', async () => {
    const elements = [
      { element: 'body', classes: ['theme-light'], style: '' }
    ]
    const { payload } = await buildPayload(
      baseInput({ elements, themeMode: ThemeMode['Same as theme'] }),
      noopStatus
    )
    const body = payload.elements.find(e => e.element === 'body')
    expect(body?.classes).toEqual(['theme-light'])
  })
})
