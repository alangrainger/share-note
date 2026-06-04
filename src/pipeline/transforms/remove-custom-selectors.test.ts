import { describe, it, expect } from 'vitest'
import { removeCustomSelectors } from './remove-custom-selectors'

function parseHtml (html: string): Document {
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html')
}

describe('removeCustomSelectors', () => {
  it('removes elements matching a single selector', () => {
    const doc = parseHtml('<p class="keep">A</p><p class="drop">B</p>')
    removeCustomSelectors(doc, '.drop')
    expect(doc.querySelectorAll('p').length).toBe(1)
    expect(doc.querySelector('p')?.textContent).toBe('A')
  })

  it('handles multiple newline-separated selectors', () => {
    const doc = parseHtml('<p class="a">A</p><p class="b">B</p><p class="c">C</p>')
    removeCustomSelectors(doc, '.a\n.b')
    const texts = Array.from(doc.querySelectorAll('p')).map(el => el.textContent)
    expect(texts).toEqual(['C'])
  })

  it('trims whitespace and ignores blank lines', () => {
    const doc = parseHtml('<p class="a">A</p><p class="b">B</p>')
    removeCustomSelectors(doc, '  .a  \n\n  \n.b')
    expect(doc.querySelectorAll('p').length).toBe(0)
  })

  it('is a no-op for empty input', () => {
    const doc = parseHtml('<p>A</p>')
    removeCustomSelectors(doc, '')
    expect(doc.querySelectorAll('p').length).toBe(1)
  })

  it('skips an invalid selector and continues with the rest', () => {
    const doc = parseHtml('<p class="keep">A</p><p class="drop">B</p>')
    removeCustomSelectors(doc, '!!! invalid !!!\n.drop')
    expect(doc.querySelectorAll('p').length).toBe(1)
    expect(doc.querySelector('p')?.textContent).toBe('A')
  })
})
