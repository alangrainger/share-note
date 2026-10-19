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
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    const filename = parsed.pathname.split('/').pop() || ''
    if (!/^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/.test(filename)) return null
    return { filename, decryptionKey: parsed.hash.slice(1), url }
  } catch {
    return null
  }
}
