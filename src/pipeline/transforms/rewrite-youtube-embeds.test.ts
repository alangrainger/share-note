import { describe, it, expect } from 'vitest'
import { rewriteYoutubeEmbeds } from './rewrite-youtube-embeds'

function parseHtml (html: string): Document {
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html')
}

const src = (doc: Document) => doc.querySelector('iframe')?.getAttribute('src')

describe('rewriteYoutubeEmbeds', () => {
  it('rewrites the Obsidian proxy URL to the YouTube embed URL', () => {
    const doc = parseHtml('<iframe src="https://releases.obsidian.md/youtube?v=dQw4w9WgXcQ"></iframe>')
    rewriteYoutubeEmbeds(doc)
    expect(src(doc)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('keeps the start offset', () => {
    const doc = parseHtml('<iframe src="https://releases.obsidian.md/youtube?v=dQw4w9WgXcQ&amp;start=42"></iframe>')
    rewriteYoutubeEmbeds(doc)
    expect(src(doc)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=42')
  })

  it('keeps the other iframe attributes', () => {
    const doc = parseHtml('<iframe class="external-embed" sandbox="allow-scripts" src="https://releases.obsidian.md/youtube?v=abc"></iframe>')
    rewriteYoutubeEmbeds(doc)
    const el = doc.querySelector('iframe')
    expect(el?.getAttribute('class')).toBe('external-embed')
    expect(el?.getAttribute('sandbox')).toBe('allow-scripts')
  })

  it('leaves other iframes alone', () => {
    const doc = parseHtml(
      '<iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe>' +
      '<iframe src="https://example.com/releases.obsidian.md/youtube?v=abc"></iframe>' +
      '<iframe></iframe>'
    )
    rewriteYoutubeEmbeds(doc)
    const srcs = Array.from(doc.querySelectorAll('iframe')).map(el => el.getAttribute('src'))
    expect(srcs).toEqual([
      'https://www.youtube-nocookie.com/embed/abc',
      'https://example.com/releases.obsidian.md/youtube?v=abc',
      null
    ])
  })

  it('ignores a proxy URL without a video id', () => {
    const doc = parseHtml('<iframe src="https://releases.obsidian.md/youtube?start=5"></iframe>')
    rewriteYoutubeEmbeds(doc)
    expect(src(doc)).toBe('https://releases.obsidian.md/youtube?start=5')
  })
})
