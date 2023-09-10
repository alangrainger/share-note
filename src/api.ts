import { requestUrl } from 'obsidian'
import SharePlugin from './main'
import StatusMessage, { StatusType } from './StatusMessage'

const pluginVersion = require('../manifest.json').version

const BASEURL = 'https://api.obsidianshare.com'
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

  async post (endpoint: string, data = {}) {
    Object.assign(data, {
      id: this.plugin.settings.uid,
      key: this.plugin.settings.apiKey,
      version: pluginVersion
    })
    try {
      return await requestUrl({
        url: BASEURL + endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
    } catch (e) {
      // I couldn't find a way to access the Request Response object,
      // so I extract the HTTP status code this way.
      const match = e.toString().match(/Request failed, status (\d+)/)
      const code = match ? +match[1] : 0
      if (match && statusCodes[code]) {
        new StatusMessage(statusCodes[code], StatusType.Error)
        throw new Error('Known error')
      }
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
