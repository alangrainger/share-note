/**
 * How a note is shared by default. `short` publishes the note unencrypted so
 * the link is just the filename; `encrypted` encrypts the note in Obsidian
 * and appends the key to the link, which makes it long.
 */
export type ShareStyle = 'short' | 'encrypted'

export interface ShareStylePromptState {
  /** True once the user has picked a style in the first-share prompt. */
  shareStyleChosen: boolean
  /**
   * The user's current default. Encrypted is the plugin default, so it says
   * nothing about whether the user chose it; unencrypted can only have been
   * set deliberately and counts as a choice.
   */
  shareUnencrypted: boolean
}

/**
 * Whether to show the share-style prompt before this share. Every share is
 * gated on it until the user has made an explicit choice, either in the
 * prompt or by switching to unencrypted in the settings.
 */
export function shouldPromptShareStyle (state: ShareStylePromptState): boolean {
  return !state.shareStyleChosen && !state.shareUnencrypted
}

/** The `shareUnencrypted` setting value that selects a style. The setting is stored inverted. */
export function toShareUnencrypted (style: ShareStyle): boolean {
  return style === 'short'
}
