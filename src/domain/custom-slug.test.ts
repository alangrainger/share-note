import { describe, it, expect } from 'vitest'
import { isSelfHostedServer, resolveCustomSlug } from './custom-slug'
import { buildFieldKeys } from './field-keys'

it('uses the configured prefix for both slug and publication identity', () => {
  expect(buildFieldKeys('pub')).toMatchObject({ slug: 'pub_slug', id: 'pub_id' })
})

describe('server eligibility', () => {
  it.each(['https://api.note.sx', 'HTTP://API.NOTE.SX:80/', 'https://api.note.sx./', 'https://note.sx', 'https://share.note.sx', '', 'not a url', 'file:///tmp'])('blocks %s', server => {
    expect(isSelfHostedServer(server)).toBe(false)
  })
  it.each(['https://notes.example/api/', 'http://localhost:3000', 'https://note.sx.example'])('accepts %s', server => {
    expect(isSelfHostedServer(server)).toBe(true)
  })
})

describe('slug policy', () => {
  it.each(['ab', 'Uppercase', 'AB', 'My_Project-Notes_', 'A'.repeat(64), 'my-project-notes', 'my_project_notes', 'note_', 'note-', '0_', 'a'.repeat(63) + '_', 'a'.repeat(64), '123'])('accepts %s', slug => {
    expect(resolveCustomSlug(slug, true)).toBe(slug)
  })
  it.each(['a', 'A', '-note', '_note', '../note', 'a/b', 'hello world', ' note ', 'a'.repeat(65), '\u4e2d\u6587', true, ['note']])('rejects %s', slug => {
    expect(() => resolveCustomSlug(slug, true)).toThrow('Invalid custom slug')
  })
  it('ignores missing, blank and disabled values', () => {
    for (const value of [undefined, null, '', '   ']) expect(resolveCustomSlug(value, true)).toBeUndefined()
    expect(resolveCustomSlug('Invalid!', false)).toBeUndefined()
  })
  it('rejects renaming any existing publication', () => {
    expect(() => resolveCustomSlug('new-slug', true, 'old-slug')).toThrow('cannot be changed')
    expect(() => resolveCustomSlug('new-slug', true, 'abcd1234')).toThrow('cannot be changed')
    expect(resolveCustomSlug('old-slug', true, 'old-slug')).toBe('old-slug')
    expect(resolveCustomSlug('My_Note', true, 'My_Note')).toBe('My_Note')
    expect(() => resolveCustomSlug('my_note', true, 'My_Note')).toThrow('cannot be changed')
    expect(resolveCustomSlug(undefined, true, 'old-slug')).toBeUndefined()
  })
})
