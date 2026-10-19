import { describe, it, expect } from 'vitest'
import { parseExistingShareUrl } from './share-link'

describe('parseExistingShareUrl', () => {
  it('extracts filename and decryption key from an encrypted share URL', () => {
    const r = parseExistingShareUrl('https://note.sx/abcd1234#thekey')
    expect(r).toEqual({
      filename: 'abcd1234',
      decryptionKey: 'thekey',
      url: 'https://note.sx/abcd1234#thekey'
    })
  })

  it('extracts filename with empty key for an unencrypted share URL', () => {
    const r = parseExistingShareUrl('https://note.sx/abcd1234')
    expect(r).toEqual({
      filename: 'abcd1234',
      decryptionKey: '',
      url: 'https://note.sx/abcd1234'
    })
  })

  it('returns null when the URL has no recognisable filename', () => {
    expect(parseExistingShareUrl('not a url at all !!!')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(parseExistingShareUrl('')).toBeNull()
  })

  it('handles a path with multiple segments', () => {
    const r = parseExistingShareUrl('https://note.sx/some/path/abcd1234#thekey')
    expect(r?.filename).toBe('abcd1234')
    expect(r?.decryptionKey).toBe('thekey')
  })
})

it('preserves a complete hyphenated slug and its fragment', () => {
  expect(parseExistingShareUrl('https://host.example/sub/my-project-notes#secret')).toEqual({
    filename: 'my-project-notes', decryptionKey: 'secret', url: 'https://host.example/sub/my-project-notes#secret'
  })
  expect(parseExistingShareUrl('https://host.example/my-project-notes')?.filename).toBe('my-project-notes')
  expect(parseExistingShareUrl('https://host.example/')).toBeNull()
  expect(parseExistingShareUrl('https://host.example/a%2Fb')).toBeNull()
})

it('preserves uppercase letters and underscores in an existing share URL', () => {
  expect(parseExistingShareUrl('https://host.example/My_Note#secret')).toEqual({
    filename: 'My_Note', decryptionKey: 'secret', url: 'https://host.example/My_Note#secret'
  })
})
