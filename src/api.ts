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
  content?: string
  template?: NoteTemplate
  encoding?: string
  encrypted?: boolean
}

export interface RawUpload {
  filetype: string
  hash: string
  content: ArrayBuffer
}

type ApiError = {
  status: number,
  message: string,
  headers?: { [key: string]: string }
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
    const body = Object.assign({}, data)
    while (retries > 0) {
      try {
        const res = await requestUrl({
          url: this.plugin.settings.server + endpoint,
          method: 'POST',
          headers: {
            ...(await this.authHeaders()),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        })
        return res.json
      } catch (error) {
        await this.handleError(error, retries)
      }
      console.log('Retrying ' + retries)
      retries--
    }
  }

  async postRaw (endpoint: string, data: RawUpload, retries = 3) {
    while (retries > 0) {
      try {
        const res = await fetch(this.plugin.settings.server + endpoint, {
          method: 'POST',
          headers: {
            ...(await this.authHeaders()),
            'x-sharenote-filetype': data.filetype,
            'x-sharenote-hash': data.hash
          },
          body: data.content
        })
        return res.json()
      } catch (error) {
        await this.handleError(error, retries)
      }
      console.log('Retrying ' + retries)
      retries--
    }
  }

  async handleError (e: ApiError, retries: number) {
    if (e.status < 500 || retries <= 1) {
      const message = e.headers?.message
      if (message) {
        new StatusMessage(message, StatusType.Error)
        throw new Error('Known error')
      }
      console.log(e)
      throw new Error('Unknown error')
    } else {
      // Delay before attempting to retry upload
      await new Promise(resolve => setTimeout(resolve, 1000))
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
      hash: data.hash
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
