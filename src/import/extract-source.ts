import { decryptString, EncryptedString } from '../crypto'
import { SOURCE_ISLAND_ID, SourceIslandData } from '../domain/source-island'

/**
 * Element id the server's note template uses for the encrypted payload
 * (`app/src/v1/WebNote.ts` addEncryptedData). Its text is the JSON
 * `{ ciphertext, ivs }` produced by encryptString().
 */
export const ENCRYPTED_DATA_ID = 'encrypted-data'

/**
 * Pull the note's Markdown source out of a shared page.
 *
 * - With a `secret`, the page is an encrypted share: decrypt the payload and
 *   read `basename` + `markdown` from the plaintext JSON.
 * - Without one, read the plaintext JSON data island.
 *
 * Returns undefined when the page carries no source (shared before the
 * feature existed, or with the setting off). Throws if decryption fails.
 */
export async function extractSharedSource (html: string, secret?: string): Promise<SourceIslandData | undefined> {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const data = secret
    ? await readEncrypted(doc, secret)
    : readIsland(doc)
  if (!data || typeof data.markdown !== 'string' || typeof data.basename !== 'string') {
    return undefined
  }
  return { basename: data.basename, markdown: data.markdown }
}

function readIsland (doc: Document): Partial<SourceIslandData> | undefined {
  const text = doc.getElementById(SOURCE_ISLAND_ID)?.textContent
  if (!text) return undefined
  return JSON.parse(text) as Partial<SourceIslandData>
}

async function readEncrypted (doc: Document, secret: string): Promise<Partial<SourceIslandData> | undefined> {
  const text = doc.getElementById(ENCRYPTED_DATA_ID)?.textContent?.trim()
  if (!text) return undefined
  const encrypted = JSON.parse(text) as Pick<EncryptedString, 'ciphertext' | 'ivs'>
  const plaintext = await decryptString(encrypted, secret)
  return JSON.parse(plaintext) as Partial<SourceIslandData>
}
