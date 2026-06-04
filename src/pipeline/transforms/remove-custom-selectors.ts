/**
 * Remove all elements matching the user-supplied CSS selectors. Each line
 * of `selectorsText` is treated as one selector; blank lines are ignored.
 *
 * If a selector throws (invalid syntax), it is silently skipped so a single
 * bad entry doesn't abort the whole share.
 */
export function removeCustomSelectors (doc: Document, selectorsText: string): void {
  const selectors = selectorsText.split('\n').map(s => s.trim()).filter(Boolean)
  for (const selector of selectors) {
    try {
      doc.querySelectorAll(selector).forEach(el => el.remove())
    } catch {
      // Skip invalid selectors silently - a malformed user rule must not
      // abort the whole share.
    }
  }
}
