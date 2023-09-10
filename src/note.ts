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
  isForceUpload: boolean
  outputFile: Template

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
    this.outputFile = new Template()

    // Make template value replacements
    this.outputFile.set(Placeholder.noteWidth, this.plugin.settings.noteWidth)
    this.outputFile.set(Placeholder.previewViewClass, this.previewViewEl.className || '')
    this.outputFile.set(Placeholder.bodyClass, document.body.className)
    this.outputFile.set(Placeholder.bodyStyle, document.body.style.cssText.replace(/"/g, '\''))
    this.outputFile.set(Placeholder.footer, this.plugin.settings.showFooter ? defaultFooter : '')

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

    // Process CSS and images
    await this.uploadCss()
    await this.processImages()

    // Encrypt the note content

    // Use previous name and key if they exist, so that links will stay consistent across updates
    let shareName
    let existingKey
    if (this.meta?.frontmatter?.[this.yamlField.link]) {
      const match = this.meta.frontmatter[this.yamlField.link].match(/(\w+)\.html#(.+?)$/)
      if (match) {
        shareName = match[1]
        existingKey = match[2]
      }
    }
    const plaintext = JSON.stringify({
      content: this.dom.body.innerHTML,
      basename: file.basename
    })
    const encryptedData = await encryptString(plaintext, existingKey)
    this.outputFile.set(Placeholder.payload, JSON.stringify({
      ciphertext: encryptedData.ciphertext,
      iv: encryptedData.iv
    }))

    // Share the file
    if (!shareName) {
      shareName = await hash(this.plugin.settings.uid + Date.now())
    }
    const shareFile = shareName + '.html'

    const baseRes = await this.upload({
      filename: shareFile,
      content: this.outputFile.html
    })
    const shareLink = baseRes + '#' + encryptedData.key

    let shareMessage = 'Note has been shared'
    if (baseRes) {
      await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter[this.yamlField.link] = shareLink
        frontmatter[this.yamlField.updated] = moment().format()
      })
      if (this.plugin.settings.clipboard) {
        await navigator.clipboard.writeText(shareLink)
        shareMessage += ' and the link has been copied to your clipboard'
      }
    }

    this.status.hide()
    new Notice(shareMessage, 6000)
  }

  async upload (data: UploadData) {
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
        const filename = (await hash(this.plugin.settings.uid + localFile)) + '.' + localFile.split('.').pop()
        const url = await this.upload({
          filename: filename,
          content: fs.readFileSync(localFile, { encoding: 'base64' }),
          encoding: 'base64'
        })
        el.setAttribute('src', url)
        el.removeAttribute('alt')
      } catch (e) {
        console.log(e)
      }
    }
  }

  /**
   * Upload theme CSS, unless this file has previously been shared,
   * or the user has requested a force re-upload
   */
  async uploadCss () {
    let uploadCss = false
    if (this.isForceUpload) {
      uploadCss = true
    } else {
      // Check with the server to see if we have an existing CSS file
      try {
        const res = await this.plugin.api.post('/v1/file/check-css')
        if (res?.json.success) {
          // There is an existing CSS file, so use that rather than uploading/replacing
          this.outputFile.set(Placeholder.css, res.json.filename)
          return
        }
      } catch (e) { }
      uploadCss = true
    }

    if (uploadCss) {
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
            const assetUrl = await this.upload({
              filename,
              content: match[2],
              encoding: 'base64'
            })
            this.css = this.css.replace(match[0], `url("${assetUrl}")`)
          }
        }
      }
      // Upload the main CSS file
      const cssUrl = await this.upload({
        filename: this.plugin.settings.uid + '.css',
        content: this.css
      })
      this.outputFile.set(Placeholder.css, cssUrl)
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

  forceUpload () {
    this.isForceUpload = true
  }
}
