import { encryptString } from '../crypto'
import NotePayload, { ElementStyle } from '../NotePayload'
import { ThemeMode, TitleSource } from '../settings'
import StatusMessage from '../StatusMessage'

export interface BuildPayloadInput {
  contentDom: Document
  // Element-style snapshots from capture. The body entry's `classes` array
  // is mutated in place when `themeMode` overrides the user's current
  // light/dark choice; pass a copy if the caller needs the original.
  elements: ElementStyle[]
  // The note's frontmatter, if any. Used for the "Frontmatter property"
  // title source.
  frontmatter?: Record<string, unknown>
  // Fallback when none of the configured title sources resolve. The
  // orchestrator typically passes `file.basename`.
  fallbackTitle: string
  // If the note has been shared before, the previously-issued filename and
  // decryption key. Reused so the resulting share URL is stable across
  // re-shares. The caller is responsible for parsing the existing share
  // link out of frontmatter.
  previousShare?: { filename: string, decryptionKey: string }
  // The frontmatter key for the user-configurable title. Built from the
  // user's yamlField setting; passed in so build-payload doesn't need
  // domain/field-keys.
  titleFrontmatterKey: string
  isEncrypted: boolean
  titleSource: TitleSource
  noteWidth: string
  themeMode: ThemeMode
}

export interface BuildPayloadResult {
  payload: NotePayload
  decryptionKey: string
}

/**
 * Assemble the NotePayload that gets sent to /v1/file/create-note. Handles:
 *
 * - Reusing the previous share's filename + key when re-sharing, so existing
 *   share URLs keep working.
 * - Title selection per the configured source, with the supplied
 *   `fallbackTitle` as the last resort.
 * - Encryption (if `isEncrypted`) or plaintext content + description preview.
 * - Body-element class override for forced light/dark mode.
 * - MathJax detection.
 *
 * Returns the assembled payload alongside the decryption key the orchestrator
 * appends to the share URL (empty for unencrypted notes).
 */
export async function buildPayload (
  input: BuildPayloadInput,
  status: StatusMessage
): Promise<BuildPayloadResult> {
  const payload: NotePayload = {
    width: '',
    elements: [],
    encrypted: input.isEncrypted,
    content: '',
    mathJax: false
  }

  let decryptionKey = ''
  if (input.previousShare) {
    payload.filename = input.previousShare.filename
    decryptionKey = input.previousShare.decryptionKey
  }

  const title = selectTitle(input) || input.fallbackTitle

  if (input.isEncrypted) {
    status.setStatus('Encrypting note...')
    const plaintext = JSON.stringify({
      content: input.contentDom.body.innerHTML,
      basename: title
    })
    const encrypted = await encryptString(plaintext, decryptionKey)
    payload.content = JSON.stringify({
      ciphertext: encrypted.ciphertext,
      ivs: encrypted.ivs
    })
    decryptionKey = encrypted.key
  } else {
    // Plaintext shares (the share_unencrypted frontmatter property route)
    // also surface a title and a meta description preview.
    payload.content = input.contentDom.body.innerHTML
    payload.title = title
    payload.description = buildDescription(input.contentDom)
  }

  payload.width = input.noteWidth
  applyThemeModeOverride(input.elements, input.themeMode)
  payload.elements = input.elements
  payload.mathJax = !!input.contentDom.querySelector('mjx-container')

  return { payload, decryptionKey }
}

function selectTitle (input: BuildPayloadInput): string | undefined {
  switch (input.titleSource) {
    case TitleSource['First H1']:
      return input.contentDom.getElementsByTagName('h1')?.[0]?.innerText
    case TitleSource['Frontmatter property']: {
      const value = input.frontmatter?.[input.titleFrontmatterKey]
      return typeof value === 'string' ? value : undefined
    }
    default:
      return undefined
  }
}

function buildDescription (contentDom: Document): string {
  const desc = Array.from(contentDom.querySelectorAll('p'))
    .map(p => p.innerText)
    .filter(Boolean)
    .join(' ')
  return desc.length > 200 ? desc.slice(0, 197) + '...' : desc
}

// Mutates `elements`: for the body entry, strip any existing theme-light /
// theme-dark class and apply the override. Original behaviour - kept inline
// because the share() pipeline expects the same array reference downstream.
function applyThemeModeOverride (elements: ElementStyle[], themeMode: ThemeMode): void {
  if (themeMode === ThemeMode['Same as theme']) return
  for (const item of elements) {
    if (item.element !== 'body') continue
    item.classes = item.classes.filter(cls => cls !== 'theme-dark' && cls !== 'theme-light')
    item.classes.push('theme-' + ThemeMode[themeMode].toLowerCase())
  }
}
