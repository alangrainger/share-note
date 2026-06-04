export interface EncryptionPolicyInputs {
  /** The user's "share unencrypted by default" setting. */
  defaultUnencrypted: boolean
  /** The active note's frontmatter, if any. */
  frontmatter: Record<string, unknown> | undefined
  /** The frontmatter property name for "force this note unencrypted". */
  unencryptedKey: string
  /** The frontmatter property name for "force this note encrypted". */
  encryptedKey: string
}

/**
 * Resolve whether a note should be encrypted, given the plugin's default
 * policy and any per-note frontmatter overrides. Returns `true` if the
 * note should be encrypted, `false` otherwise.
 *
 * Precedence (later rules override earlier):
 *   1. Plugin default (encrypted unless `defaultUnencrypted` is set).
 *   2. Frontmatter `<unencryptedKey>: true` -> unencrypted.
 *   3. Frontmatter `<encryptedKey>: true` -> encrypted.
 *
 * The encrypted-key check comes last so that a user can opt in to encryption
 * on a single note even if they've globally chosen unencrypted defaults.
 */
export function resolveEncryption (input: EncryptionPolicyInputs): boolean {
  let encrypted = !input.defaultUnencrypted
  if (input.frontmatter?.[input.unencryptedKey] === true) {
    encrypted = false
  }
  if (input.frontmatter?.[input.encryptedKey] === true) {
    encrypted = true
  }
  return encrypted
}
