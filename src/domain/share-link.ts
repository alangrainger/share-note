import type { TFile } from 'obsidian'

export interface SharedUrl {
  filename: string
  decryptionKey: string
  url: string
}

// A shared URL paired with the local TFile it lives on. Convenience type used
// at the boundary between the plugin's vault-facing code and the domain.
export interface SharedNote extends SharedUrl {
  file: TFile
}

/**
 * Parse a previously-shared URL of the form `https://.../<filename>#<key>`.
 * Returns the filename and decryption key, or `null` if the URL doesn't match.
 *
 * The decryption key lives in the URL fragment so it never reaches the server.
 * An empty key (no fragment) is valid - that's how unencrypted shares look.
 */
export function parseExistingShareUrl (url: string): SharedUrl | null {
  const match = url.match(/(\w+)(#.+?|)$/)
  if (!match) return null
  return {
    filename: match[1],
    decryptionKey: match[2].slice(1) || '',
    url
  }
}
