import { describe, it, expect } from 'vitest'
import { availablePath, sanitiseBasename } from './vault-path'

describe('availablePath', () => {
  it('returns the plain path when free', () => {
    expect(availablePath(() => false, 'Inbox', 'Note', 'md')).toBe('Inbox/Note.md')
  })

  it('adds a numeric suffix on clash', () => {
    const taken = new Set(['Note.md', 'Note 1.md'])
    expect(availablePath(p => taken.has(p), '', 'Note', 'md')).toBe('Note 2.md')
  })

  it('treats "/" as the vault root', () => {
    expect(availablePath(() => false, '/', 'Note', 'md')).toBe('Note.md')
  })
})

describe('sanitiseBasename', () => {
  it('strips characters Obsidian rejects', () => {
    expect(sanitiseBasename('A/B: "C" [D] #E')).toBe('A B C D E')
  })

  it('falls back when nothing is left', () => {
    expect(sanitiseBasename('???')).toBe('Shared note')
  })
})
