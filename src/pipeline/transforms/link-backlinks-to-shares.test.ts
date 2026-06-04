import { describe, it, expect } from 'vitest'
import { linkBacklinksToShares } from './link-backlinks-to-shares'

function parseHtml (html: string): Document {
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html')
}

const backlinkHtml = (name: string) => `
  <div class="embedded-backlinks">
    <div class="search-result-file-title is-clickable">
      <div class="tree-item-inner">${name}</div>
    </div>
  </div>
`

describe('linkBacklinksToShares', () => {
  it('adds an onclick + force-cursor class when the backlink resolves to a shared URL', () => {
    const doc = parseHtml(backlinkHtml('Linked Note'))
    linkBacklinksToShares(doc, {
      resolveSharedLink: name => name === 'Linked Note' ? 'https://note.sx/abc#k' : undefined
    })
    const el = doc.querySelector<HTMLElement>('.search-result-file-title')!
    expect(el.getAttribute('onclick')).toBe("window.location.href='https://note.sx/abc#k'")
    expect(el.classList.contains('force-cursor')).toBe(true)
  })

  it('leaves the element alone when the backlink is not shared', () => {
    const doc = parseHtml(backlinkHtml('Unshared Note'))
    linkBacklinksToShares(doc, { resolveSharedLink: () => undefined })
    const el = doc.querySelector<HTMLElement>('.search-result-file-title')!
    expect(el.getAttribute('onclick')).toBeNull()
    expect(el.classList.contains('force-cursor')).toBe(false)
  })

  it('skips entries with no inner text', () => {
    const doc = parseHtml(`
      <div class="embedded-backlinks">
        <div class="search-result-file-title is-clickable"></div>
      </div>
    `)
    linkBacklinksToShares(doc, { resolveSharedLink: () => 'https://x' })
    expect(doc.querySelector('.search-result-file-title')?.getAttribute('onclick')).toBeNull()
  })
})
