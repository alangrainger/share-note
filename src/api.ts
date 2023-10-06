import { requestUrl } from 'obsidian'
import SharePlugin from './main'
import StatusMessage, { StatusType } from './StatusMessage'
import { sha256 } from './crypto'
import NoteTemplate from './NoteTemplate'

const pluginVersion = require('../manifest.json').version

export interface UploadData {
  filename: string
  filetype?: string
  content?: string
  template?: NoteTemplate
  encoding?: string
  encrypted?: boolean
}

export default class API {
  plugin: SharePlugin

  constructor (plugin: SharePlugin) {
    this.plugin = plugin
  }

  async post (endpoint: string, data?: UploadData, retries = 1) {
    const nonce = Date.now().toString()
    const body = Object.assign({}, data, {
      id: this.plugin.settings.uid,
      key: await sha256(nonce + this.plugin.settings.apiKey),
      nonce,
      version: pluginVersion
    })
    while (retries > 0) {
      try {
        const res = await requestUrl({
          url: this.plugin.settings.server + endpoint,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        })
        return res.json
      } catch (e) {
        if (e.status < 500 || retries <= 1) {
          let message = e.headers.message
          if (message) {
            if (e.headers.status === 415 && data?.filename && data.filename.match(/^\w+\.\w+$/)) {
              // Detailed message for unknown filetype
              message = `Unsupported media type ${data.filename.split('.')[1].toUpperCase()}, please open an issue on Github`
            }
            new StatusMessage(message, StatusType.Error)
            throw new Error('Known error')
          }
          console.log(e)
          throw new Error('Unknown error')
        }
      }
      console.log('Retrying ' + retries)
      retries--
    }
  }

  async upload (data: UploadData) {
    // Test for existing file
    if (data.filetype && !['html', 'css'].includes(data.filetype)) {
      const exists = await this.post('/v1/file/check-file', {
        filename: data.filename
      })
      if (exists?.success) {
        return exists.url
      }
    }
    const res = await this.post('/v1/file/upload', data, 3)
    return res.url
  }

  async createNote (template: NoteTemplate) {
    const res = await this.post('/v1/file/create-note', {
      filename: template.filename,
      template
    }, 3)
    return res.url
  }
}
