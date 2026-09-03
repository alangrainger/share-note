/**
 * Element id of the JSON data island that carries a note's Markdown source
 * inside an unencrypted shared page. The import side looks the element up by
 * this id, so the share and import code must agree on it.
 */
export const SOURCE_ISLAND_ID = 'share-note-source'

export interface SourceIslandData {
  basename: string
  markdown: string
}

/**
 * Serialise the note source as a `<script type="application/json">` data
 * island. A JSON script element is inert: it is not rendered, not read by
 * screen readers and not matched by find-in-page, unlike a hidden `<div>`.
 *
 * The only way the Markdown can break out of the element is a literal
 * `</script>` in the source, so `</` is escaped as `<\/`. That is still valid
 * JSON and parses back to the original text.
 */
export function buildSourceIsland (data: SourceIslandData): string {
  const json = JSON.stringify(data).replace(/<\//g, '<\\/')
  return `<script type="application/json" id="${SOURCE_ISLAND_ID}">${json}</script>`
}
