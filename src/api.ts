import { requestUrl } from 'obsidian'
import SharePlugin from './main'
import StatusMessage, { StatusType } from './StatusMessage'
import { hash } from './crypto'

const pluginVersion = require('../manifest.json').version

export interface UploadData {
  filename: string;
  content: string;
  encoding?: string;
  encrypted?: boolean;
}

export default class API {
  plugin: SharePlugin

  constructor (plugin: SharePlugin) {
    this.plugin = plugin
  }

  async post (endpoint: string, data?: UploadData) {
    const nonce = Date.now().toString()
    const body = Object.assign({}, data, {
      id: this.plugin.settings.uid,
      key: await hash(nonce + this.plugin.settings.apiKey),
      nonce,
      version: pluginVersion
    })
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

  async upload (data: UploadData) {
    const res = await this.post('/v1/file/upload', data)
    return res.url
  }
}
