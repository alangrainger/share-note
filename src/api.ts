import { requestUrl } from 'obsidian'
import SharePlugin from './main'
const pluginVersion = require('../manifest.json').version

const BASEURL = 'https://api.obsidianshare.com'

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

  async post (endpoint: string, data: object) {
    Object.assign(data, {
      id: this.plugin.settings.uid,
      key: this.plugin.settings.apiKey,
      version: pluginVersion
    })
    try {
      return requestUrl({
        url: BASEURL + endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
    } catch (e) {
      console.log(e)
    }
  }

  async upload (data: UploadData) {
    const res = await this.post('/v1/file/upload', data)
    if (res && res.status === 200) {
      return 'https://file.obsidianshare.com/' + data.filename
    } else {
      return ''
    }
  }
}
