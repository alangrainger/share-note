import { requestUrl } from 'obsidian'
import StatusMessage, { StatusType } from './StatusMessage'
import { sha1, sha256 } from './crypto'
import NotePayload from './NotePayload'
import { parseExistingShareUrl } from './domain/share-link'
import { compressImage } from './Compressor'
import { SettingsStore } from './shared/settings-store'
import { logger } from './shared/logger'
import { AuthError, NetworkError, UploadError } from './shared/errors'

export interface ApiDeps {
  settings: SettingsStore
  manifestVersion: string
  // Called when the server reports the auth token is missing or invalid
  // (HTTP 462). Lets the API stay ignorant of the redirect/UI flow.
  onUnauthenticated: () => void
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
  template?: NotePayload // wire key — kept as 'template' for server backwards compat
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

  constructor (private readonly deps: ApiDeps) {}

  private get settings () {
    return this.deps.settings.data
  }

  async authHeaders () {
    const nonce = Date.now().toString()
    return {
      'x-sharenote-id': this.settings.uid,
      'x-sharenote-key': await sha256(nonce + this.settings.apiKey),
      'x-sharenote-nonce': nonce,
      'x-sharenote-version': this.deps.manifestVersion
    }
  }

  async post<T = unknown> (endpoint: string, data?: PostData, retries = 1): Promise<T> {
    const headers: Record<string, string> = {
      ...(await this.authHeaders()),
      'Content-Type': 'application/json'
    }
    if (data?.byteLength) headers['x-sharenote-bytelength'] = data.byteLength.toString()
    const body: PostData = { ...data }
    if (this.settings.debug) body.debug = this.settings.debug

    while (retries > 0) {
      const res = await requestUrl({
        url: this.settings.server + endpoint,
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        throw: false
      })
      if (res.status === 200) return res.json

      if (res.status < 500 || retries <= 1) {
        // Permanent error - surface the server's message and stop retrying
        const message = res.headers?.message
        if (message) {
          new StatusMessage(message, StatusType.Error)
          if (res.status === 462) {
            // Invalid API key, request a new one
            this.deps.onUnauthenticated()
            throw new AuthError(message, { status: res.status, handled: true })
          }
          throw new NetworkError(message, { status: res.status, handled: true })
        }
        throw new NetworkError('Unknown server error', { status: res.status })
      }

      // Transient server error - wait then retry
      await new Promise(resolve => window.setTimeout(resolve, 1000))
      retries--
    }
    throw new NetworkError('Retries exhausted')
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
        url: this.settings.server + endpoint,
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
          throw new NetworkError(message, { status: res.status, handled: true })
        }
        throw new NetworkError('Unknown server error', { status: res.status })
      }

      // Transient server error - wait then retry
      await new Promise(resolve => window.setTimeout(resolve, 1000))
      retries--
    }
    throw new NetworkError('Retries exhausted')
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
          } catch (e) {
            // Individual upload failures are non-fatal; the asset will just be missing
            logger.error(new UploadError(`${type} upload failed`, { cause: e }))
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

  async createNote (payload: NotePayload, expiration?: number) {
    const res = await this.post<{ url: string }>('/v1/file/create-note', {
      filename: payload.filename,
      filetype: 'html',
      hash: await sha1(payload.content),
      expiration,
      template: payload // wire key kept as 'template' for server backwards compat
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
