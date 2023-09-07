import { requestUrl } from 'obsidian'
import SharePlugin from './main'

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
      key: this.plugin.settings.apiKey
    })
    return requestUrl({
      url: BASEURL + endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
  }

  async upload (data: UploadData) {
    const res = await this.post('/upload', data)
    if (res.status === 200) {
      return 'https://file.obsidianshare.com/' + data.filename
    } else {
      return ''
    }
  }
}
