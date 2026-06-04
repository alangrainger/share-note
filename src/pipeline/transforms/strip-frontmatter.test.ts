import { describe, it, expect } from 'vitest'
import { stripFrontmatter } from './strip-frontmatter'

function parseHtml (html: string): Document {
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html')
}

describe('stripFrontmatter', () => {
  it('removes div.metadata-container', () => {
    const doc = parseHtml('<div class="metadata-container">props</div><p>body</p>')
    stripFrontmatter(doc)
    expect(doc.querySelector('div.metadata-container')).toBeNull()
    expect(doc.querySelector('p')?.textContent).toBe('body')
  })

  it('removes pre.frontmatter (older Obsidian rendering)', () => {
    const doc = parseHtml('<pre class="frontmatter">---\ntitle: x\n---</pre><p>body</p>')
    stripFrontmatter(doc)
    expect(doc.querySelector('pre.frontmatter')).toBeNull()
  })

  it('removes div.frontmatter-container', () => {
    const doc = parseHtml('<div class="frontmatter-container">x</div>')
    stripFrontmatter(doc)
    expect(doc.querySelector('div.frontmatter-container')).toBeNull()
  })

  it('is a no-op when none of the targeted elements are present', () => {
    const doc = parseHtml('<p>body only</p>')
    stripFrontmatter(doc)
    expect(doc.querySelector('p')?.textContent).toBe('body only')
  })
})
