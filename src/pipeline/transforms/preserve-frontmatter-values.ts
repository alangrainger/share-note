/**
 * Obsidian's frontmatter property elements render with empty `value`
 * attributes - the live values come from the metadata cache at runtime,
 * not from the static HTML. For sharing we need them inline, so we
 * rehydrate each `<input>` from the cache before publishing.
 */
export function preserveFrontmatterValues (
  doc: Document,
  frontmatter: Record<string, unknown> | undefined
): void {
  doc.querySelectorAll('div.metadata-property').forEach(propertyContainerEl => {
    const propertyName = propertyContainerEl.getAttribute('data-property-key')
    if (!propertyName) return

    const labelEl = propertyContainerEl.querySelector('input.metadata-property-key-input')
    labelEl?.setAttribute('value', propertyName)

    const valueEl = propertyContainerEl.querySelector('div.metadata-property-value > input')
    const value = frontmatter?.[propertyName] ?? ''
    // Preserves legacy behaviour: objects coerce to '[object Object]'. Obsidian
    // frontmatter is overwhelmingly primitives and arrays; this stays bug-for-bug
    // compatible with the previous implementation.
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    valueEl?.setAttribute('value', String(value))

    if (valueEl?.getAttribute('type') === 'checkbox' && value) {
      valueEl.setAttribute('checked', 'checked')
    }
  })
}
