import { describe, it, expect } from 'vitest'
import { splitCssIntoChunks } from './upload-css'

describe('splitCssIntoChunks', () => {
  it('returns a single chunk when CSS is small', () => {
    const css = '.a{color:red}.b{color:blue}'
    expect(splitCssIntoChunks(css, 1024)).toEqual([css])
  })

  it('splits at rule boundaries for large CSS', () => {
    // Build many small rules so we cross the size limit at a `}` boundary.
    const rule = '.selector-' + 'x'.repeat(40) + '{color:#ffffff;margin:0;padding:0;}'
    const css = rule.repeat(30)
    const chunks = splitCssIntoChunks(css, 500)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join('')).toBe(css)
    // Prefer ending on a complete rule.
    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk.trimEnd().endsWith('}')).toBe(true)
    }
  })

  it('force-splits extremely long unbroken content', () => {
    const css = 'a'.repeat(2000)
    const chunks = splitCssIntoChunks(css, 500)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join('')).toBe(css)
  })
})
