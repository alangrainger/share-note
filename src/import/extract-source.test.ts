import { describe, it, expect } from 'vitest'
import { encryptString } from '../crypto'
import { buildSourceIsland } from '../domain/source-island'
import { ENCRYPTED_DATA_ID, extractSharedSource } from './extract-source'

const source = { basename: 'My note', markdown: '# Hi\n\nText with </script> inside.' }

function page (inner: string): string {
  return `<html><body><div class="markdown-preview-view">${inner}</div></body></html>`
}

async function encryptedPage (plaintext: object) {
  const enc = await encryptString(JSON.stringify(plaintext))
  const payload = JSON.stringify({ ciphertext: enc.ciphertext, ivs: enc.ivs })
  return {
    html: page(`<div id='${ENCRYPTED_DATA_ID}' style='display: none'>${payload}</div>`),
    secret: enc.key
  }
}

describe('extractSharedSource', () => {
  it('reads the plaintext data island', async () => {
    const html = page('<p>Hello</p>' + buildSourceIsland(source))
    expect(await extractSharedSource(html)).toEqual(source)
  })

  it('decrypts an encrypted share and reads the markdown key', async () => {
    const { html, secret } = await encryptedPage({ content: '<p>Hello</p>', ...source })
    expect(await extractSharedSource(html, secret)).toEqual(source)
  })

  it('returns undefined when the page has no source', async () => {
    expect(await extractSharedSource(page('<p>Hello</p>'))).toBeUndefined()
    const { html, secret } = await encryptedPage({ content: '<p>Hello</p>', basename: 'x' })
    expect(await extractSharedSource(html, secret)).toBeUndefined()
  })

  it('throws when the secret is wrong', async () => {
    const { html } = await encryptedPage({ content: '', ...source })
    const other = await encryptString('x')
    await expect(extractSharedSource(html, other.key)).rejects.toThrow()
  })
})
