import { describe, it, expect } from 'vitest'
import { resolveEncryption } from './encryption-policy'

const KEYS = { unencryptedKey: 'share_unencrypted', encryptedKey: 'share_encrypted' }

describe('resolveEncryption', () => {
  it('defaults to encrypted when no overrides apply', () => {
    expect(resolveEncryption({
      ...KEYS,
      defaultUnencrypted: false,
      frontmatter: undefined
    })).toBe(true)
  })

  it('defaults to unencrypted when settings say so', () => {
    expect(resolveEncryption({
      ...KEYS,
      defaultUnencrypted: true,
      frontmatter: undefined
    })).toBe(false)
  })

  it('frontmatter unencrypted=true overrides the encrypted default', () => {
    expect(resolveEncryption({
      ...KEYS,
      defaultUnencrypted: false,
      frontmatter: { share_unencrypted: true }
    })).toBe(false)
  })

  it('frontmatter encrypted=true overrides the unencrypted default', () => {
    expect(resolveEncryption({
      ...KEYS,
      defaultUnencrypted: true,
      frontmatter: { share_encrypted: true }
    })).toBe(true)
  })

  it('frontmatter encrypted=true wins when both encrypted and unencrypted are set', () => {
    expect(resolveEncryption({
      ...KEYS,
      defaultUnencrypted: false,
      frontmatter: { share_unencrypted: true, share_encrypted: true }
    })).toBe(true)
  })

  it('ignores non-true frontmatter values', () => {
    // The plugin only honours an explicit boolean true; strings, false, etc.
    // should not toggle encryption.
    expect(resolveEncryption({
      ...KEYS,
      defaultUnencrypted: false,
      frontmatter: { share_unencrypted: 'yes' }
    })).toBe(true)
    expect(resolveEncryption({
      ...KEYS,
      defaultUnencrypted: true,
      frontmatter: { share_encrypted: 1 }
    })).toBe(false)
  })
})
