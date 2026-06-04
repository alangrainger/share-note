import { describe, it, expect } from 'vitest'
import { rewriteLinks } from './rewrite-links'

function parseHtml (html: string): Document {
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html')
}

describe('rewriteLinks', () => {
  it('rewrites a heading anchor to an onclick scrollIntoView', () => {
    const doc = parseHtml(`
      <h2 data-heading="Intro">Intro</h2>
      <a class="internal-link" href="#Intro" target="_blank">go</a>
    `)
    rewriteLinks(doc, { resolveSharedLink: () => undefined })
    const link = doc.querySelector<HTMLElement>('a.internal-link')!
    expect(link.getAttribute('onclick')).toContain('scrollIntoView')
    // Quotes inside the selector are backslash-escaped for the embedded JS.
    expect(link.getAttribute('onclick')).toContain('data-heading=\\"Intro\\"')
    expect(link.getAttribute('href')).toBeNull()
    expect(link.getAttribute('target')).toBeNull()
  })

  it('rewrites a footnote anchor when the target exists by id', () => {
    const doc = parseHtml(`
      <li id="fn-1">footnote</li>
      <a class="footnote-link" href="#fn-1">[1]</a>
    `)
    rewriteLinks(doc, { resolveSharedLink: () => undefined })
    const link = doc.querySelector<HTMLElement>('a.footnote-link')!
    expect(link.getAttribute('onclick')).toContain('id=\\"fn-1\\"')
  })

  it('unwraps an anchor link whose target does not exist', () => {
    const doc = parseHtml('<a class="internal-link" href="#missing">phantom</a>')
    rewriteLinks(doc, { resolveSharedLink: () => undefined })
    expect(doc.querySelector('a')).toBeNull()
    expect(doc.body.textContent?.trim()).toBe('phantom')
  })

  it('points an internal link at a shared URL when one is available', () => {
    const doc = parseHtml('<a class="internal-link" href="Some Note" target="_blank">Some Note</a>')
    rewriteLinks(doc, {
      resolveSharedLink: name => name === 'Some Note' ? 'https://note.sx/abc#k' : undefined
    })
    const link = doc.querySelector<HTMLElement>('a.internal-link')!
    expect(link.getAttribute('href')).toBe('https://note.sx/abc#k')
    expect(link.getAttribute('target')).toBeNull()
  })

  it('unwraps an internal link whose target is not shared', () => {
    const doc = parseHtml('<a class="internal-link" href="Some Note">Some Note</a>')
    rewriteLinks(doc, { resolveSharedLink: () => undefined })
    expect(doc.querySelector('a')).toBeNull()
    expect(doc.body.textContent?.trim()).toBe('Some Note')
  })

  it('strips section-suffix from internal hrefs before lookup', () => {
    // Obsidian renders [[Note#Section]] as href="Note#Section"; we look up
    // by the note name only.
    let lookedUpWith: string | undefined
    const doc = parseHtml('<a class="internal-link" href="Some Note#Section">link</a>')
    rewriteLinks(doc, {
      resolveSharedLink: (name) => {
        lookedUpWith = name
        return undefined
      }
    })
    expect(lookedUpWith).toBe('Some Note')
  })

  it('leaves non-internal/footnote anchors alone', () => {
    const doc = parseHtml('<a class="external-link" href="https://x" target="_blank">x</a>')
    rewriteLinks(doc, { resolveSharedLink: () => undefined })
    expect(doc.querySelector('a.external-link')?.getAttribute('href')).toBe('https://x')
  })
})
