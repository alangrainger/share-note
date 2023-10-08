import { requestUrl } from 'obsidian'
import SharePlugin from './main'
import StatusMessage, { StatusType } from './StatusMessage'
import { sha1, sha256 } from './crypto'
import NoteTemplate from './NoteTemplate'

const pluginVersion = require('../manifest.json').version

export interface UploadData {
  filename?: string
  filetype: string
  hash: string
  content?: string,
  byteLength?: number
  template?: NoteTemplate
  encoding?: string
  encrypted?: boolean
}

export interface RawUpload {
  filetype: string
  hash: string
  content: ArrayBuffer,
  byteLength: number
}

export default class API {
  plugin: SharePlugin

  constructor (plugin: SharePlugin) {
    this.plugin = plugin
  }

  async authHeaders () {
    const nonce = Date.now().toString()
    return {
      'x-sharenote-id': this.plugin.settings.uid,
      'x-sharenote-key': await sha256(nonce + this.plugin.settings.apiKey),
      'x-sharenote-nonce': nonce,
      'x-sharenote-version': pluginVersion
    }
  }

  async post (endpoint: string, data?: UploadData, retries = 1) {
    const headers: HeadersInit = {
      ...(await this.authHeaders()),
      'Content-Type': 'application/json'
    }
    if (data?.byteLength) headers['x-sharenote-bytelength'] = data.byteLength.toString()
    const body = Object.assign({}, data)
    while (retries > 0) {
      try {
        const res = await requestUrl({
          url: this.plugin.settings.server + endpoint,
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        })
        return res.json
      } catch (error) {
        if (error.status < 500 || retries <= 1) {
          const message = error.headers?.message
          if (message) {
            new StatusMessage(message, StatusType.Error)
            throw new Error('Known error')
          }
          console.log(error)
          throw new Error('Unknown error')
        } else {
          // Delay before attempting to retry upload
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      console.log('Retrying ' + retries)
      retries--
    }
  }

  async postRaw (endpoint: string, data: RawUpload, retries = 3) {
    const headers: HeadersInit = {
      ...(await this.authHeaders()),
      'x-sharenote-filetype': data.filetype,
      'x-sharenote-hash': data.hash
    }
    if (data.byteLength) headers['x-sharenote-bytelength'] = data.byteLength.toString()
    while (retries > 0) {
      const res = await fetch(this.plugin.settings.server + endpoint, {
        method: 'POST',
        headers,
        body: data.content
      })
      if (res.status !== 200) {
        if (res.status < 500 || retries <= 1) {
          const message = await res.text()
          if (message) {
            new StatusMessage(message, StatusType.Error)
            throw new Error('Known error')
          }
          throw new Error('Unknown error')
        }
        // Delay before attempting to retry upload
        await new Promise(resolve => setTimeout(resolve, 1000))
      } else {
        return res.json()
      }
      console.log('Retrying ' + retries)
      retries--
    }
  }

  async upload (data: UploadData) {
    return this._upload(data)
  }

  async uploadBinary (data: RawUpload) {
    return this._upload(data)
  }

  private async _upload (data: UploadData | RawUpload) {
    // Test for existing file before uploading any data
    const exists = await this.post('/v1/file/check-file', {
      filetype: data.filetype,
      hash: data.hash,
      byteLength: data.byteLength
    })
    if (exists?.success) {
      return exists.url
    } else {
      const res = await this.postRaw('/v1/file/upload', data as RawUpload)
      return res.url
    }
  }

  async createNote (template: NoteTemplate) {
    const res = await this.post('/v1/file/create-note', {
      filename: template.filename,
      filetype: 'html',
      hash: await sha1(template.content),
      template
    }, 3)
    return res.url
  }
}
