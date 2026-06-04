import { RewriteLinksContext } from './rewrite-links'

/**
 * In the embedded backlinks panel, each backlink is a `div` (not an `<a>`).
 * Where the back-linked note has its own shared URL, wire an `onclick`
 * handler so readers can navigate. Where it doesn't, leave the element
 * inert - the visible text is fine on its own.
 */
export function linkBacklinksToShares (doc: Document, ctx: RewriteLinksContext): void {
  for (const el of doc.querySelectorAll<HTMLElement>('.embedded-backlinks .search-result-file-title.is-clickable')) {
    const linkText = el.querySelector<HTMLElement>('.tree-item-inner')?.innerText
    if (!linkText) continue
    const sharedUrl = ctx.resolveSharedLink(linkText)
    if (sharedUrl) {
      el.setAttribute('onclick', `window.location.href='${sharedUrl}'`)
      el.classList.add('force-cursor')
    }
  }
}
