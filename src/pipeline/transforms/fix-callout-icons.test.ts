import { describe, it, expect } from 'vitest'
import { fixCalloutIcons } from './fix-callout-icons'

function parseHtml (html: string): Document {
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html')
}

function rulesFor (css: string): CSSRule[] {
  const doc = parseHtml('')
  const style = doc.createElement('style')
  style.textContent = css
  doc.head.appendChild(style)
  return Array.from(style.sheet!.cssRules)
}

const calloutHtml = (type: string, svgClass = '') => `
  <div class="callout" data-callout="${type}">
    <div class="callout-icon"><svg class="${svgClass}" width="24" height="24"></svg></div>
    <div class="callout-content">body</div>
  </div>
`

describe('fixCalloutIcons', () => {
  it('replaces the SVG with a data-share-note-lucide placeholder for the matched type', () => {
    const doc = parseHtml(calloutHtml('warning'))
    const rules = rulesFor('.callout[data-callout="warning"] { --callout-icon: lucide-alert-triangle; }')
    fixCalloutIcons(doc, rules)
    const svg = doc.querySelector('.callout svg')
    expect(svg?.getAttribute('data-share-note-lucide')).toBe('alert-triangle')
    expect(svg?.getAttribute('width')).toBe('16')
    expect(svg?.getAttribute('height')).toBe('16')
  })

  it('prefers the rendered SVG\'s lucide- class over the CSS variable', () => {
    // Regression for the "quote-glyph" bug: Obsidian's --callout-icon
    // for [data-callout="quote"] is the internal name `quote-glyph`, which
    // Lucide can't resolve. The rendered SVG carries class="lucide-quote",
    // which is the right name.
    const doc = parseHtml(calloutHtml('quote', 'svg-icon lucide-quote'))
    const rules = rulesFor('.callout[data-callout="quote"] { --callout-icon: quote-glyph; }')
    fixCalloutIcons(doc, rules)
    const svg = doc.querySelector('.callout svg')
    expect(svg?.getAttribute('data-share-note-lucide')).toBe('quote')
  })

  it('falls back to the CSS variable when no lucide- class is on the SVG', () => {
    const doc = parseHtml(calloutHtml('warning', 'svg-icon'))
    const rules = rulesFor('.callout[data-callout="warning"] { --callout-icon: lucide-alert-triangle; }')
    fixCalloutIcons(doc, rules)
    const svg = doc.querySelector('.callout svg')
    expect(svg?.getAttribute('data-share-note-lucide')).toBe('alert-triangle')
  })

  it('falls back to the .callout default when no per-type rule exists', () => {
    const doc = parseHtml(calloutHtml('unknown-type'))
    const rules = rulesFor('.callout { --callout-icon: lucide-quote; }')
    fixCalloutIcons(doc, rules)
    const svg = doc.querySelector('.callout svg')
    expect(svg?.getAttribute('data-share-note-lucide')).toBe('quote')
  })

  it('falls back to "pencil" when there is no callout rule at all', () => {
    const doc = parseHtml(calloutHtml('note'))
    fixCalloutIcons(doc, [])
    const svg = doc.querySelector('.callout svg')
    expect(svg?.getAttribute('data-share-note-lucide')).toBe('pencil')
  })

  it('does nothing for callouts without an existing icon SVG', () => {
    const doc = parseHtml('<div class="callout" data-callout="info"><p>body</p></div>')
    fixCalloutIcons(doc, [])
    expect(doc.querySelector('svg')).toBeNull()
  })

  it('strips the "lucide-" prefix from the icon name', () => {
    const doc = parseHtml(calloutHtml('note'))
    const rules = rulesFor('.callout[data-callout="note"] { --callout-icon: lucide-info; }')
    fixCalloutIcons(doc, rules)
    expect(doc.querySelector('.callout svg')?.getAttribute('data-share-note-lucide')).toBe('info')
  })
})
