import { CachedMetadata, moment, Notice, TFile, WorkspaceLeaf } from 'obsidian'
import Template, { Placeholder, defaultFooter } from './template'
import { encryptString, hash } from './crypto'
import SharePlugin from './main'
import { UploadData } from './api'
import * as fs from 'fs'

interface YamlField {
  link: string;
  updated: string;
  hash: string;
}

export default class Note {
  plugin: SharePlugin
  leaf: WorkspaceLeaf
  status: Notice
  content: string
  previewViewEl: Element
  css: string
  dom: Document
  meta: CachedMetadata | null
  yamlField: YamlField

  constructor (plugin: SharePlugin) {
    this.plugin = plugin
    this.leaf = this.plugin.app.workspace.getLeaf()
    // Set up YAML property names based on the user's chosen prefix
    const base = this.plugin.settings.yamlField
    this.yamlField = {
      link: base + '_link',
      updated: base + '_updated',
      hash: base + '_hash',
    }
  }

  async parse () {
    const startMode = this.leaf.getViewState()
    const previewMode = this.leaf.getViewState()
    previewMode.state.mode = 'preview'
    await this.leaf.setViewState(previewMode)
    // Even though we 'await', sometimes the view isn't ready. This helps reduce no-content errors
    await new Promise(resolve => setTimeout(resolve, 200))
    try {
      // @ts-ignore // 'view.modes'
      this.content = this.leaf.view.modes.preview.renderer.sections.reduce((p, c) => p + c.el.innerHTML, '')
      // Fetch the preview view classes
      this.previewViewEl = document.getElementsByClassName('markdown-preview-view markdown-rendered')[0]
      this.css = [...Array.from(document.styleSheets)].map(x => {
        try {
          return [...Array.from(x.cssRules)].map(x => x.cssText).join('')
        } catch (e) {
          return ''
        }
      }).filter(Boolean).join('').replace(/\n/g, '')
    } catch (e) {
      console.log(e)
      new Notice('Failed to parse current note, check console for details', 5000)
      return
    }
    if (!this.content) {
      new Notice('Failed to read current note, please try again.', 5000)
      return
    }

    // Reset the view to the original mode
    // The timeout is required, even though we 'await' the preview mode setting earlier
    setTimeout(() => { this.leaf.setViewState(startMode) }, 200)

    // Create a semi-permanent status notice which we can update
    this.status = new Notice('Sharing note...', 30 * 1000)

    const file = this.plugin.app.workspace.getActiveFile()
    if (!(file instanceof TFile)) {
      // No active file
      this.status.hide()
      return
    }
    this.meta = this.plugin.app.metadataCache.getFileCache(file)
    const outputFile = new Template()

    // Make template value replacements
    outputFile.set(Placeholder.css, `${this.plugin.settings.uid}.css`)
    outputFile.set(Placeholder.noteWidth, this.plugin.settings.noteWidth)
    outputFile.set(Placeholder.previewViewClass, this.previewViewEl.className || '')
    outputFile.set(Placeholder.bodyClass, document.body.className)
    outputFile.set(Placeholder.bodyStyle, document.body.style.cssText.replace(/"/g, '\''))
    outputFile.set(Placeholder.footer, this.plugin.settings.showFooter ? defaultFooter : '')

    // Generate the HTML file for uploading
    this.dom = new DOMParser().parseFromString(this.content, 'text/html')
    if (this.plugin.settings.removeYaml) {
      // Remove frontmatter to avoid sharing unwanted data
      this.dom.querySelector('div.metadata-container')?.remove()
      this.dom.querySelector('pre.frontmatter')?.remove()
      this.dom.querySelector('div.frontmatter-container')?.remove()
    }

    // Replace links
    for (const el of this.dom.querySelectorAll('a.internal-link')) {
      const hrefEl = el.getAttribute('href')
      const href = hrefEl ? hrefEl.match(/^([^#]+)/) : null
      if (href) {
        const linkedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(href[1], '')
        if (linkedFile instanceof TFile) {
          const linkedMeta = this.plugin.app.metadataCache.getFileCache(linkedFile)
          if (linkedMeta?.frontmatter?.[this.yamlField.link]) {
            // This file is shared, so update the link with the share URL
            el.setAttribute('href', linkedMeta.frontmatter[this.yamlField.link])
            el.removeAttribute('target')
            continue
          }
        }
      }
      // This file is not shared, so remove the link and replace with the non-link content
      el.replaceWith(el.innerHTML)
    }

    // Upload local images
    await this.processImages()

    // Encrypt the note content

    // Use previous key if it exists, so that links will stay consistent across updates
    let existingKey
    if (this.meta?.frontmatter?.[this.yamlField.link]) {
      const key = this.meta.frontmatter[this.yamlField.link].match(/#(.+)$/)
      if (key) {
        existingKey = key[1]
      }
    }
    const plaintext = JSON.stringify({
      content: this.dom.body.innerHTML,
      basename: file.basename
    })
    const encryptedData = await encryptString(plaintext, existingKey)
    outputFile.set(Placeholder.payload, JSON.stringify({
      ciphertext: encryptedData.ciphertext,
      iv: encryptedData.iv
    }))

    // Share the file
    const shareName = this.meta?.frontmatter?.[this.yamlField.hash] || await hash(this.plugin.settings.uid + file.path)
    const shareFile = shareName + '.html'

    const baseRes = await this.upload({
      filename: shareFile,
      content: outputFile.html
    })
    const shareLink = baseRes + '#' + encryptedData.key
    await this.uploadCss()

    let shareNoticeSuffix = ''
    if (baseRes) {
      await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter[this.yamlField.link] = shareLink
        frontmatter[this.yamlField.updated] = moment().format()
      })
      if (this.plugin.settings.clipboard) {
        await navigator.clipboard.writeText(shareLink)
        shareNoticeSuffix = ' and the link has been copied to your clipboard'
      }
    }

    this.status.hide()
    new Notice('Note has been shared' + shareNoticeSuffix, 4000)
  }

  async upload (data: UploadData) {
    // this.status.setMessage(`Uploading ${data.filename}...`)
    return this.plugin.api.upload(data)
  }

  /**
   * Upload images encoded as base64
   */
  async processImages () {
    for (const el of this.dom.querySelectorAll('img')) {
      const src = el.getAttribute('src')
      if (!src || !src.startsWith('app://')) continue
      try {
        const srcMatch = src.match(/app:\/\/\w+\/([^?#]+)/)
        if (!srcMatch) continue
        const localFile = window.decodeURIComponent(srcMatch[1])
        const url = (await hash(this.plugin.settings.uid + localFile)) + '.' + localFile.split('.').pop()
        el.setAttribute('src', url)
        el.removeAttribute('alt')
        await this.upload({
          filename: url,
          content: fs.readFileSync(localFile, { encoding: 'base64' }),
          encoding: 'base64'
        })
      } catch (e) {
        console.log(e)
      }
    }
  }

  /**
   * Upload theme CSS, unless this file has previously been shared.
   * To force a CSS re-upload, just remove the `share_link` frontmatter field.
   */
  async uploadCss () {
    if (!this.meta?.frontmatter?.[this.yamlField.link]) {
      await this.upload({ filename: this.plugin.settings.uid + '.css', content: this.css })
      // Extract any base64 encoded attachments from the CSS.
      // Will use the mime-type whitelist to determine which attachments to extract.
      const regex = /url\s*\(\W*data:([^;,]+)[^)]*?base64\s*,\s*([A-Za-z0-9/=+]+).?\)/
      for (const attachment of this.css.match(new RegExp(regex, 'g')) || []) {
        const match = attachment.match(new RegExp(regex))
        if (match) {
          // ALlow whitelisted mime-types/extensions only
          const extension = this.extensionFromMime(match[1])
          if (extension) {
            const filename = (await hash(match[2])) + '.' + extension
            this.css = this.css.replace(match[0], `url("${filename}")`)
            await this.upload({
              filename,
              content: match[2],
              encoding: 'base64'
            })
          }
        }
      }
    }
  }

  /**
   * Turn the font mime-type into an extension.
   * @param {string} mimeType
   * @return {string|undefined}
   */
  extensionFromMime (mimeType: string) {
    const mimes: { [key: string]: string[] } = {
      ttf: ['font/ttf', 'application/x-font-ttf', 'application/x-font-truetype', 'font/truetype'],
      otf: ['font/otf', 'application/x-font-opentype'],
      woff: ['font/woff', 'application/font-woff', 'application/x-font-woff'],
      woff2: ['font/woff2', 'application/font-woff2', 'application/x-font-woff2']
    }
    return Object.keys(mimes).find(x => mimes[x].includes((mimeType || '').toLowerCase()))
  }
}
