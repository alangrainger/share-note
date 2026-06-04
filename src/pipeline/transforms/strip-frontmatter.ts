/**
 * Remove all frontmatter/properties UI from the document. Used when the
 * user has opted to hide their note's properties from the public share.
 */
export function stripFrontmatter (doc: Document): void {
  doc.querySelector('div.metadata-container')?.remove()
  doc.querySelector('pre.frontmatter')?.remove()
  doc.querySelector('div.frontmatter-container')?.remove()
}
