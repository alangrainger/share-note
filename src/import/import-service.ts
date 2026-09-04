import { App, requestUrl } from 'obsidian'
import StatusMessage, { StatusType } from '../StatusMessage'
import { logger } from '../shared/logger'
import { availablePath, sanitiseBasename } from '../domain/vault-path'
import { extractSharedSource } from './extract-source'

export interface ImportRequest {
  /** The shared page URL, without the `#key` fragment. */
  url: string
  /** The decryption key for an encrypted share; absent for plaintext shares. */
  secret?: string
}

/**
 * Handles the "Save to Obsidian" button on a shared page: fetch the page,
 * pull the embedded Markdown source out (decrypting if needed), and create
 * the note in the user's default new-note folder. No prompts: the note gets
 * the shared title, a numeric suffix on clash, and opens immediately.
 */
export class ImportService {
  constructor (private readonly deps: { app: App }) {}

  async importFromShare ({ url, secret }: ImportRequest): Promise<void> {
    const status = new StatusMessage('Importing shared note...', StatusType.Default, 30 * 1000)
    try {
      // Only fetch over https, except from a local dev server.
      if (!/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
        throw new Error(`Refusing to import from a non-https URL: ${url}`)
      }
      const res = await requestUrl({ url, throw: false })
      if (res.status !== 200) {
        throw new Error(`HTTP ${res.status} fetching ${url}`)
      }
      const source = await extractSharedSource(res.text, secret)
      if (!source) {
        new StatusMessage('This note was shared without its source, so it cannot be imported.', StatusType.Error, 8000)
        return
      }

      const { app } = this.deps
      const folder = app.fileManager.getNewFileParent('')
      const path = availablePath(
        p => app.vault.getAbstractFileByPath(p) !== null,
        folder.path,
        sanitiseBasename(source.basename),
        'md'
      )
      const file = await app.vault.create(path, source.markdown)
      await app.workspace.getLeaf(true).openFile(file, { active: true })
      new StatusMessage(`Imported "${file.basename}" into your vault`, StatusType.Success, 6000)
    } catch (e) {
      logger.error('Import failed:', e)
      new StatusMessage('Unable to import the shared note. See the developer console for details.', StatusType.Error, 8000)
    } finally {
      status.hide()
    }
  }
}
