const FRONTMATTER_SELECTORS = ['div.metadata-container', 'pre.frontmatter', 'div.frontmatter-container']

// Wrappers Obsidian puts around an embedded note (`![[Note]]`).
const EMBED_SELECTORS = ['.internal-embed', '.markdown-embed']

/**
 * Remove all frontmatter/properties UI from the document, including any
 * inside embedded notes. Used when the user has opted to hide their note's
 * properties from the public share.
 */
export function stripFrontmatter (doc: Document): void {
  removeAll(doc, FRONTMATTER_SELECTORS)
}

/**
 * Remove the properties UI of embedded notes only, leaving the host note's
 * own properties block alone.
 *
 * Obsidian renders a `.metadata-container` inside a whole-note embed but
 * always hides it in reading view, so the published page should never show
 * it. The captured rows are empty anyway (their values come from the
 * metadata cache at runtime), and preserveFrontmatterValues would otherwise
 * fill them from the host note's frontmatter.
 * https://github.com/alangrainger/share-note/issues/213
 */
export function stripEmbeddedFrontmatter (doc: Document): void {
  const selectors = EMBED_SELECTORS.flatMap(embed => FRONTMATTER_SELECTORS.map(fm => `${embed} ${fm}`))
  removeAll(doc, selectors)
}

function removeAll (doc: Document, selectors: string[]): void {
  doc.querySelectorAll(selectors.join(', ')).forEach(el => el.remove())
}
