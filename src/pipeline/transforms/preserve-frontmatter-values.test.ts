import { describe, it, expect } from 'vitest'
import { preserveFrontmatterValues } from './preserve-frontmatter-values'

function parseHtml (html: string): Document {
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html')
}

function metadataProperty (key: string, type = 'text'): string {
  return `
    <div class="metadata-property" data-property-key="${key}">
      <input class="metadata-property-key-input" value="" />
      <div class="metadata-property-value">
        <input type="${type}" value="" />
      </div>
    </div>
  `
}

describe('preserveFrontmatterValues', () => {
  it('writes the property name onto the label input', () => {
    const doc = parseHtml(metadataProperty('title'))
    preserveFrontmatterValues(doc, { title: 'Hello' })
    expect(doc.querySelector('input.metadata-property-key-input')?.getAttribute('value')).toBe('title')
  })

  it('writes the matching frontmatter value onto the value input', () => {
    const doc = parseHtml(metadataProperty('title'))
    preserveFrontmatterValues(doc, { title: 'Hello' })
    const valueInput = doc.querySelector('div.metadata-property-value > input')
    expect(valueInput?.getAttribute('value')).toBe('Hello')
  })

  it('uses an empty string when the frontmatter has no matching key', () => {
    const doc = parseHtml(metadataProperty('title'))
    preserveFrontmatterValues(doc, {})
    const valueInput = doc.querySelector('div.metadata-property-value > input')
    expect(valueInput?.getAttribute('value')).toBe('')
  })

  it('marks checkbox inputs as checked when the value is truthy', () => {
    const doc = parseHtml(metadataProperty('done', 'checkbox'))
    preserveFrontmatterValues(doc, { done: true })
    const valueInput = doc.querySelector('div.metadata-property-value > input')
    expect(valueInput?.getAttribute('checked')).toBe('checked')
  })

  it('does not mark checkbox inputs as checked when the value is falsy', () => {
    const doc = parseHtml(metadataProperty('done', 'checkbox'))
    preserveFrontmatterValues(doc, { done: false })
    const valueInput = doc.querySelector('div.metadata-property-value > input')
    expect(valueInput?.getAttribute('checked')).toBeNull()
  })

  it('skips elements missing data-property-key', () => {
    const doc = parseHtml('<div class="metadata-property"><input class="metadata-property-key-input" /></div>')
    preserveFrontmatterValues(doc, { foo: 'bar' })
    const labelInput = doc.querySelector('input.metadata-property-key-input')
    expect(labelInput?.getAttribute('value')).toBeNull()
  })

  it('treats undefined frontmatter as empty', () => {
    const doc = parseHtml(metadataProperty('title'))
    preserveFrontmatterValues(doc, undefined)
    const valueInput = doc.querySelector('div.metadata-property-value > input')
    expect(valueInput?.getAttribute('value')).toBe('')
  })
})
