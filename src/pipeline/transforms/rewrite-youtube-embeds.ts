const OBSIDIAN_YOUTUBE_PROXY = 'https://releases.obsidian.md/youtube'
const YOUTUBE_EMBED_BASE = 'https://www.youtube-nocookie.com/embed/'

/**
 * Point YouTube embeds back at YouTube.
 *
 * When Obsidian renders `![](https://youtube.com/watch?v=ID)` inside the app
 * it gives the iframe its own proxy URL, `https://releases.obsidian.md/youtube?v=ID&start=N`,
 * which does not load in a normal browser. Outside the app Obsidian uses
 * `https://www.youtube-nocookie.com/embed/ID?start=N`, so the published page
 * gets that form. https://github.com/alangrainger/share-note/issues/193
 */
export function rewriteYoutubeEmbeds (doc: Document): void {
  for (const el of doc.querySelectorAll('iframe')) {
    const src = el.getAttribute('src')
    if (!src?.startsWith(OBSIDIAN_YOUTUBE_PROXY)) continue

    let proxied: URL
    try {
      proxied = new URL(src)
    } catch {
      continue
    }
    const videoId = proxied.searchParams.get('v')
    if (!videoId) continue

    const target = new URL(YOUTUBE_EMBED_BASE + encodeURIComponent(videoId))
    const start = proxied.searchParams.get('start')
    if (start) target.searchParams.set('start', start)
    el.setAttribute('src', target.toString())
  }
}
