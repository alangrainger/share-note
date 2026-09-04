import { describe, it, expect } from 'vitest'
import { stripEmbeddedFrontmatter, stripFrontmatter } from './strip-frontmatter'

function parseHtml (html: string): Document {
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html')
}

// A host note with its own properties block, embedding a note that has one too.
const HOST_WITH_EMBED =
  '<div class="metadata-container" data-host>host props</div>' +
  '<p>body</p>' +
  '<span class="internal-embed markdown-embed inline-embed is-loaded" src="Other">' +
  '<div class="markdown-embed-content"><div class="markdown-preview-view">' +
  '<div class="metadata-container" data-embedded>embedded props</div><p>embedded body</p>' +
  '</div></div></span>'

describe('stripFrontmatter', () => {
  it('removes div.metadata-container', () => {
    const doc = parseHtml('<div class="metadata-container">props</div><p>body</p>')
    stripFrontmatter(doc)
    expect(doc.querySelector('div.metadata-container')).toBeNull()
    expect(doc.querySelector('p')?.textContent).toBe('body')
  })

  it('removes every properties block, including those inside embedded notes', () => {
    const doc = parseHtml(HOST_WITH_EMBED)
    stripFrontmatter(doc)
    expect(doc.querySelectorAll('div.metadata-container').length).toBe(0)
    expect(doc.querySelector('.internal-embed p')?.textContent).toBe('embedded body')
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

describe('stripEmbeddedFrontmatter', () => {
  it('removes the properties block of an embedded note but keeps the host note\'s', () => {
    const doc = parseHtml(HOST_WITH_EMBED)
    stripEmbeddedFrontmatter(doc)
    expect(doc.querySelector('[data-embedded]')).toBeNull()
    expect(doc.querySelector('[data-host]')?.textContent).toBe('host props')
    expect(doc.querySelector('.internal-embed p')?.textContent).toBe('embedded body')
  })

  it('matches embeds that only carry the markdown-embed class', () => {
    const doc = parseHtml('<div class="markdown-embed"><div class="metadata-container">x</div></div>')
    stripEmbeddedFrontmatter(doc)
    expect(doc.querySelector('div.metadata-container')).toBeNull()
  })

  it('is a no-op when the note has no embeds', () => {
    const doc = parseHtml('<div class="metadata-container">host props</div><p>body</p>')
    stripEmbeddedFrontmatter(doc)
    expect(doc.querySelector('div.metadata-container')?.textContent).toBe('host props')
  })
})
