/**
 * Strip `target="_blank"` from external links so the shared page navigates
 * in-place rather than opening yet another tab.
 */
export function removeExternalTargets (doc: Document): void {
  doc.querySelectorAll<HTMLElement>('a.external-link').forEach(el => {
    el.removeAttribute('target')
  })
}
