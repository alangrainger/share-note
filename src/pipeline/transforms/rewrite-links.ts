export interface RewriteLinksContext {
  /**
   * Look up whether `linkText` resolves to a note that has its own shared
   * URL. Returns the public URL if so, undefined otherwise. The caller
   * wires this up against the Obsidian metadata cache.
   */
  resolveSharedLink: (linkText: string) => string | undefined
}

/**
 * Rewrite all internal links (`a.internal-link`, `a.footnote-link`) in the
 * document:
 *
 *   1. Heading/footnote anchors (`#name`) become `onclick` scroll handlers.
 *   2. Internal note links whose target has been shared point at the
 *      public URL.
 *   3. Internal links whose target has NOT been shared are unwrapped to
 *      plain text so the reader doesn't get dead Obsidian-internal URLs.
 */
export function rewriteLinks (doc: Document, ctx: RewriteLinksContext): void {
  for (const el of doc.querySelectorAll<HTMLElement>('a.internal-link, a.footnote-link')) {
    const href = el.getAttribute('href')

    if (href?.startsWith('#')) {
      if (rewriteAnchorLink(doc, el, href)) continue
      // Anchor rewrite failed for some reason - drop the link entirely
      // rather than leaving a non-functional one in the published page.
    } else if (href) {
      const match = href.match(/^([^#]+)/)
      if (match) {
        const sharedUrl = ctx.resolveSharedLink(match[1])
        if (sharedUrl) {
          el.setAttribute('href', sharedUrl)
          el.removeAttribute('target')
          continue
        }
      }
    }

    // Not rewritable - unwrap to plain text.
    el.replaceWith(el.innerText)
  }
}

function rewriteAnchorLink (doc: Document, el: HTMLElement, href: string): boolean {
  try {
    const heading = href.slice(1).replace(/(['"])/g, '\\$1')
    const selectors = [
      `[data-heading="${heading}"]`, // headings
      `[id="${heading}"]`            // footnotes
    ]
    let matched = false
    for (const selector of selectors) {
      if (doc.querySelectorAll(selector)[0]) {
        // Double-escape double quotes for the embedded onclick string.
        el.setAttribute(
          'onclick',
          `document.querySelectorAll('${selector.replace(/"/g, '\\"')}')[0].scrollIntoView(true)`
        )
        matched = true
      }
    }
    el.removeAttribute('target')
    el.removeAttribute('href')
    return matched
  } catch {
    return false
  }
}
