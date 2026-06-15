import { describe, it, expect } from 'vitest'
import {
  encryptString,
  sha1,
  sha256,
  shortHash,
  arrayBufferToBase64,
  base64ToArrayBuffer
} from './crypto'

/**
 * Mirrors the server's `decrypt.js` template logic so we can prove the
 * client output decrypts exactly the way a baked-in page will.
 */
async function decryptForTest (payload: { ciphertext: string[]; ivs: string[] }, key: string) {
  const aesKey = await crypto.subtle.importKey(
    'raw',
    base64ToArrayBuffer(key),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
  const decoder = new TextDecoder()
  const parts: string[] = []
  for (let i = 0; i < payload.ciphertext.length; i++) {
    const iv = new Uint8Array(base64ToArrayBuffer(payload.ivs[i]))
    const buf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      base64ToArrayBuffer(payload.ciphertext[i])
    )
    parts.push(decoder.decode(buf))
  }
  return parts.join('')
}

describe('encryptString', () => {
  it('round-trips short plaintext via the server-compatible decryptor', async () => {
    const plaintext = 'hello world'
    const enc = await encryptString(plaintext)
    const back = await decryptForTest({ ciphertext: enc.ciphertext, ivs: enc.ivs }, enc.key)
    expect(back).toBe(plaintext)
  })

  it('round-trips multi-chunk plaintext (>2000 chars per chunk)', async () => {
    const plaintext = 'a'.repeat(5000)
    const enc = await encryptString(plaintext)
    expect(enc.ciphertext.length).toBe(Math.ceil(5000 / 2000))
    expect(enc.ivs.length).toBe(enc.ciphertext.length)
    const back = await decryptForTest({ ciphertext: enc.ciphertext, ivs: enc.ivs }, enc.key)
    expect(back).toBe(plaintext)
  })

  it('uses a fresh random IV on each chunk', async () => {
    const enc = await encryptString('a'.repeat(5000))
    const uniqueIvs = new Set(enc.ivs)
    expect(uniqueIvs.size).toBe(enc.ivs.length)
  })

  it('produces different ciphertext on repeated encryption with the same key', async () => {
    // This is the IV-reuse regression test: with deterministic per-chunk
    // IVs (the old behaviour), ciphertext[0] would be identical across
    // re-shares of the same content with the same key.
    const plaintext = 'hello world'
    const a = await encryptString(plaintext)
    const b = await encryptString(plaintext, a.key)
    expect(b.ciphertext[0]).not.toBe(a.ciphertext[0])
    expect(b.ivs[0]).not.toBe(a.ivs[0])
  })

  it('returns a 22-character base64 key (128-bit)', async () => {
    const enc = await encryptString('hello')
    expect(enc.key.length).toBe(22)
  })

  it('reuses and preserves a legacy 256-bit key on re-share', async () => {
    // Notes first shared under the old scheme carry a 43-char (32-byte) key.
    // Re-sharing must keep that full key intact, not truncate it to 22 chars.
    const legacyKey = arrayBufferToBase64(crypto.getRandomValues(new Uint8Array(32)).buffer).replace(/=+$/, '')
    expect(legacyKey.length).toBe(43)
    const reshared = await encryptString('hello', legacyKey)
    expect(reshared.key).toBe(legacyKey)
    const back = await decryptForTest({ ciphertext: reshared.ciphertext, ivs: reshared.ivs }, reshared.key)
    expect(back).toBe('hello')
  })
})

describe('sha hashes', () => {
  it('sha1 is deterministic and 40 hex chars', async () => {
    const a = await sha1('hello')
    expect(a).toBe(await sha1('hello'))
    expect(a).toMatch(/^[0-9a-f]{40}$/)
  })

  it('sha256 matches the known vector for "hello"', async () => {
    expect(await sha256('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  })

  it('shortHash returns 32 hex chars', async () => {
    const h = await shortHash('test')
    expect(h.length).toBe(32)
    expect(h).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('base64 codec', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255])
    const back = new Uint8Array(base64ToArrayBuffer(arrayBufferToBase64(bytes.buffer)))
    expect(Array.from(back)).toEqual([0, 1, 2, 254, 255])
  })
})
