import { requestUrl } from 'obsidian'
import SharePlugin from './main'
import StatusMessage, { StatusType } from './StatusMessage'
import { sha1, sha256 } from './crypto'
import NoteTemplate from './NoteTemplate'
import { SharedUrl } from './note'
import { compressImage } from './Compressor'

/**
 * Thrown when we've already surfaced a user-facing error message and the caller
 * should swallow the throw silently. Use this instead of `new Error('Known error')`
 * to avoid magic-string flow control.
 */
export class HandledError extends Error {
  readonly handled = true
  constructor (message = 'Handled error') {
    super(message)
    this.name = 'HandledError'
  }
}

export interface FileUpload {
  filetype: string
  hash: string
  content?: ArrayBuffer | string
  byteLength: number
  expiration?: number
  url?: string | null
}

export type PostData = {
  files?: FileUpload[]
  filename?: string
  filetype?: string
  hash?: string
  byteLength?: number
  expiration?: number
  template?: NoteTemplate
  debug?: number
}

export interface UploadQueueItem {
  data: FileUpload
  callback: (url: string) => void
}

export interface CheckFilesResult {
  success: boolean
  files: FileUpload[]
  css?: {
    url: string
    hash: string
  }
}

export default class API {
  uploadQueue: UploadQueueItem[] = []

  constructor (private readonly plugin: SharePlugin) {}

  async authHeaders () {
    const nonce = Date.now().toString()
    return {
      'x-sharenote-id': this.plugin.settings.uid,
      'x-sharenote-key': await sha256(nonce + this.plugin.settings.apiKey),
      'x-sharenote-nonce': nonce,
      'x-sharenote-version': this.plugin.manifest.version
    }
  }

  async post<T = unknown> (endpoint: string, data?: PostData, retries = 1): Promise<T> {
    const headers: Record<string, string> = {
      ...(await this.authHeaders()),
      'Content-Type': 'application/json'
    }
    if (data?.byteLength) headers['x-sharenote-bytelength'] = data.byteLength.toString()
    const body: PostData = { ...data }
    if (this.plugin.settings.debug) body.debug = this.plugin.settings.debug

    while (retries > 0) {
      const res = await requestUrl({
        url: this.plugin.settings.server + endpoint,
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        throw: false
      })
      if (res.status === 200) return res.json

      if (res.status < 500 || retries <= 1) {
        // Permanent error — surface the server's message and stop retrying
        const message = res.headers?.message
        if (message) {
          new StatusMessage(message, StatusType.Error)
          if (res.status === 462) {
            // Invalid API key, request a new one
            void this.plugin.authRedirect('share')
          }
          throw new HandledError(message)
        }
        throw new Error('Unknown error')
      }

      // Transient server error — wait then retry
      await new Promise(resolve => activeWindow.setTimeout(resolve, 1000))
      retries--
    }
    throw new Error('Retries exhausted')
  }

  async postRaw<T = unknown> (endpoint: string, data: FileUpload, retries = 4): Promise<T> {
    const headers: Record<string, string> = {
      ...(await this.authHeaders()),
      'x-sharenote-filetype': data.filetype,
      'x-sharenote-hash': data.hash
    }
    if (data.byteLength) headers['x-sharenote-bytelength'] = data.byteLength.toString()
    while (retries > 0) {
      const res = await requestUrl({
        url: this.plugin.settings.server + endpoint,
        method: 'POST',
        headers,
        body: data.content,
        throw: false
      })
      if (res.status === 200) return res.json

      if (res.status < 500 || retries <= 1) {
        const message = res.text
        if (message) {
          new StatusMessage(message, StatusType.Error)
          throw new HandledError(message)
        }
        throw new Error('Unknown error')
      }

      // Transient server error — wait then retry
      await new Promise(resolve => activeWindow.setTimeout(resolve, 1000))
      retries--
    }
    throw new Error('Retries exhausted')
  }

  async queueUpload (item: UploadQueueItem) {
    // Compress the data if possible (only image binary blobs are compressible;
    // string content like Excalidraw SVG is left alone)
    if (item.data.content && typeof item.data.content !== 'string') {
      const compressed = await compressImage(item.data.content, item.data.filetype)
      if (compressed.changed) {
        item.data.content = compressed.data
        item.data.filetype = compressed.filetype
      }
    }
    this.uploadQueue.push(item)
  }

  async processQueue (status: StatusMessage, type = 'attachment') {
    // Check with the server to find which files need to be updated
    const res = await this.post<CheckFilesResult>('/v1/file/check-files', {
      files: this.uploadQueue.map(x => ({
        hash: x.data.hash,
        filetype: x.data.filetype,
        byteLength: x.data.byteLength
      }))
    })

    let count = 1
    const total = this.uploadQueue.length
    const uploads: Promise<void>[] = []
    for (const queueItem of this.uploadQueue) {
      const checkFile = res?.files.find((item: FileUpload) =>
        item.hash === queueItem.data.hash && item.filetype === queueItem.data.filetype)
      if (checkFile?.url) {
        // File is already uploaded on the server; just run the callback
        status.setStatus(`Uploading ${type} ${count++} of ${total}...`)
        queueItem.callback(checkFile.url)
      } else {
        uploads.push((async () => {
          try {
            const uploaded = await this.postRaw<{ url: string }>('/v1/file/upload', queueItem.data)
            status.setStatus(`Uploading ${type} ${count++} of ${total}...`)
            queueItem.callback(uploaded.url)
          } catch (_e) {
            // Individual upload failures are non-fatal; the asset will just be missing
          }
        })())
      }
    }
    await Promise.all(uploads)
    this.uploadQueue = []
    return res
  }

  async upload (data: FileUpload) {
    const res = await this.postRaw<{ url: string }>('/v1/file/upload', data)
    return res.url
  }

  async createNote (template: NoteTemplate, expiration?: number) {
    const res = await this.post<{ url: string }>('/v1/file/create-note', {
      filename: template.filename,
      filetype: 'html',
      hash: await sha1(template.content),
      expiration,
      template
    }, 3)
    return res.url
  }

  async deleteSharedNote (shareUrl: string) {
    const url = parseExistingShareUrl(shareUrl)
    if (url) {
      await this.post('/v1/file/delete', {
        filename: url.filename,
        filetype: 'html'
      })
      new StatusMessage('The note has been deleted 🗑️', StatusType.Info)
    }
  }
}

export function parseExistingShareUrl (url: string): SharedUrl | null {
  const match = url.match(/(\w+)(#.+?|)$/)
  if (!match) return null
  return {
    filename: match[1],
    decryptionKey: match[2].slice(1) || '',
    url
  }
}
