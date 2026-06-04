import { describe, it, expect } from 'vitest'
import { stripBacklinks } from './strip-backlinks'

function parseHtml (html: string): Document {
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html')
}

describe('stripBacklinks', () => {
  it('removes the embedded-backlinks block', () => {
    const doc = parseHtml('<p>body</p><div class="embedded-backlinks">links</div>')
    stripBacklinks(doc)
    expect(doc.querySelector('div.embedded-backlinks')).toBeNull()
    expect(doc.querySelector('p')?.textContent).toBe('body')
  })

  it('is a no-op when no backlinks block is present', () => {
    const doc = parseHtml('<p>body only</p>')
    stripBacklinks(doc)
    expect(doc.querySelector('p')?.textContent).toBe('body only')
  })
})
