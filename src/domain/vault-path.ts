/** Characters Obsidian does not allow in file names. */
const INVALID_NAME_CHARS = /[\\/:*?"<>|#^[\]]/g

/**
 * Turn a shared note's title into a usable file basename: strip characters
 * Obsidian rejects and collapse the result. Falls back to "Shared note" when
 * nothing usable remains.
 */
export function sanitiseBasename (title: string): string {
  const cleaned = title.replace(INVALID_NAME_CHARS, ' ').replace(/\s+/g, ' ').trim()
  return cleaned || 'Shared note'
}

/**
 * First `<folder>/<basename>.<ext>` path that `exists` reports free, adding a
 * numeric suffix on clash: `Note.md`, `Note 1.md`, `Note 2.md`, ...
 * A root folder is `''` or `'/'`.
 */
export function availablePath (
  exists: (path: string) => boolean,
  folder: string,
  basename: string,
  ext: string
): string {
  const dir = folder && folder !== '/' ? `${folder}/` : ''
  for (let n = 0; ; n++) {
    const candidate = `${dir}${basename}${n ? ` ${n}` : ''}.${ext}`
    if (!exists(candidate)) return candidate
  }
}
