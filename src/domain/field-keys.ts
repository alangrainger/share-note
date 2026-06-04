/**
 * The set of frontmatter property suffixes the plugin uses on each shared note.
 * The actual property name is `<prefix>_<suffix>` (default prefix "share"),
 * e.g. `share_link`, `share_updated`.
 */
export enum YamlField {
  link,
  updated,
  encrypted,
  unencrypted,
  title,
  expires
}

export interface FieldKeys {
  link: string
  updated: string
  encrypted: string
  unencrypted: string
  title: string
  expires: string
}

/**
 * Build the full frontmatter property name for a single field, given the
 * user's configured prefix (e.g. "share") and a field identifier.
 */
export function buildFieldKey (prefix: string, key: YamlField): string {
  return `${prefix}_${YamlField[key]}`
}

/**
 * Build the full set of frontmatter keys for the given prefix.
 * Useful when working with several keys at once.
 */
export function buildFieldKeys (prefix: string): FieldKeys {
  return {
    link: buildFieldKey(prefix, YamlField.link),
    updated: buildFieldKey(prefix, YamlField.updated),
    encrypted: buildFieldKey(prefix, YamlField.encrypted),
    unencrypted: buildFieldKey(prefix, YamlField.unencrypted),
    title: buildFieldKey(prefix, YamlField.title),
    expires: buildFieldKey(prefix, YamlField.expires)
  }
}
