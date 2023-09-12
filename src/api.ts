import { requestUrl } from 'obsidian'
import SharePlugin from './main'
import StatusMessage, { StatusType } from './StatusMessage'

const pluginVersion = require('../manifest.json').version

const statusCodes: { [key: number]: string } = {
  400: 'Malformed request, please try again',
  401: 'Invalid API key, please request a new one through the Settings page',
  403: 'Unable to find the file to update, please delete any existing share links and try again',
  415: 'Unsupported media type, please open an issue on Github'
}

export interface UploadData {
  filename: string;
  content: string;
  encoding?: string;
}

export default class API {
  plugin: SharePlugin

  constructor (plugin: SharePlugin) {
    this.plugin = plugin
  }

  async post (endpoint: string, data: any = {}) {
    Object.assign(data, {
      id: this.plugin.settings.uid,
      key: this.plugin.settings.apiKey,
      version: pluginVersion
    })
    try {
      return await requestUrl({
        url: this.plugin.settings.server + endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
    } catch (e) {
      // I couldn't find a way to access the Request Response object,
      // so I extract the HTTP status code this way.
      const match = e.message.match(/Request failed, status (\d+)/)
      const code = match ? +match[1] : 0
      if (match && statusCodes[code]) {
        let message = statusCodes[code]
        if (code === 415 && data.filename && data.filename.match(/^\w+\.\w+$/)) {
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
    if (res && res.status === 200 && res.json.success) {
      return res.json.filename
    } else {
      return ''
    }
  }
}
