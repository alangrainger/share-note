import { describe, it, expect } from 'vitest'
import { removeExternalTargets } from './remove-external-targets'

function parseHtml (html: string): Document {
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html')
}

describe('removeExternalTargets', () => {
  it('removes the target attribute from external links', () => {
    const doc = parseHtml('<a class="external-link" href="https://x" target="_blank">x</a>')
    removeExternalTargets(doc)
    expect(doc.querySelector('a.external-link')?.getAttribute('target')).toBeNull()
    expect(doc.querySelector('a.external-link')?.getAttribute('href')).toBe('https://x')
  })

  it('leaves internal links alone', () => {
    const doc = parseHtml('<a class="internal-link" href="#foo" target="_blank">x</a>')
    removeExternalTargets(doc)
    expect(doc.querySelector('a.internal-link')?.getAttribute('target')).toBe('_blank')
  })
})
