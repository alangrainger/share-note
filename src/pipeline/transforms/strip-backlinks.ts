/**
 * Remove the embedded backlinks panel rendered at the bottom of a note.
 * Used when the user has opted to hide backlinks from their public share.
 */
export function stripBacklinks (doc: Document): void {
  doc.querySelector('div.embedded-backlinks')?.remove()
}
