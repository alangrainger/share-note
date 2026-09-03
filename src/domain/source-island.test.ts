import { describe, it, expect } from 'vitest'
import { buildSourceIsland, SOURCE_ISLAND_ID } from './source-island'

describe('buildSourceIsland', () => {
  it('escapes a closing script tag inside the source', () => {
    const html = buildSourceIsland({ basename: 'n', markdown: 'a</script><b>' })
    // Only the wrapper's own closing tag may appear.
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    expect(html).toContain('<\\/script>')
  })

  it('round-trips through DOMParser and JSON.parse', () => {
    const data = { basename: 'Note "title"', markdown: '# Heading\n\n</script>\n<div>\\n' }
    const doc = new DOMParser().parseFromString(
      `<html><body><p>x</p>${buildSourceIsland(data)}</body></html>`,
      'text/html'
    )
    const el = doc.getElementById(SOURCE_ISLAND_ID)
    expect(el?.getAttribute('type')).toBe('application/json')
    expect(JSON.parse(el?.textContent ?? '')).toEqual(data)
  })
})
