import { CachedMetadata, moment, TFile, WorkspaceLeaf } from 'obsidian'
import Template from './template'
import { arrayBufferToBase64, encryptString, hash } from './crypto'
import SharePlugin from './main'
import { UploadData } from './api'
import * as fs from 'fs'
import StatusMessage, { StatusType } from './StatusMessage'

export enum YamlField {
  link,
  updated,
  unencrypted
}

const cssAttachmentWhitelist: { [key: string]: string[] } = {
  ttf: ['font/ttf', 'application/x-font-ttf', 'application/x-font-truetype', 'font/truetype'],
  otf: ['font/otf', 'application/x-font-opentype'],
  woff: ['font/woff', 'application/font-woff', 'application/x-font-woff'],
  woff2: ['font/woff2', 'application/font-woff2', 'application/x-font-woff2'],
  svg: ['image/svg+xml']
}

export default class Note {
  plugin: SharePlugin
  leaf: WorkspaceLeaf
  status: StatusMessage
  content: string
  previewViewEl: Element
  css: string
  dom: Document
  meta: CachedMetadata | null
  outputFile: Template
  isEncrypted = true
  isForceUpload = false
  isForceClipboard = false
  uploadedFiles: string[]

  constructor (plugin: SharePlugin) {
    this.plugin = plugin
    this.leaf = this.plugin.app.workspace.getLeaf()
  }

  /**
   * Return the name (key) of a frontmatter property, eg 'share_link'
   * @param key
   * @return {string} The name (key) of a frontmatter property
   */
  field (key: YamlField) {
    return [this.plugin.settings.yamlField, YamlField[key]].join('_')
  }

  async share () {
    if (!this.plugin.settings.uid || !this.plugin.settings.apiKey) return

    // Create a semi-permanent status notice which we can update
    this.status = new StatusMessage('Sharing note...', StatusType.Default, 30 * 1000)

    this.uploadedFiles = []
    const startMode = this.leaf.getViewState()
    const previewMode = this.leaf.getViewState()
    previewMode.state.mode = 'preview'
    await this.leaf.setViewState(previewMode)
    await new Promise(resolve => setTimeout(resolve, 200))
    // Scroll the view to the top to ensure we get the default margins for .markdown-preview-pusher
    // @ts-ignore // 'view.previewMode'
    this.leaf.view.previewMode.applyScroll(0)
    // Even though we 'await', sometimes the view isn't ready. This helps reduce no-content errors
    await new Promise(resolve => setTimeout(resolve, 1000))
    try {
      // @ts-ignore // 'view.modes'
      this.content = this.leaf.view.modes.preview.renderer.sections.reduce((p, c) => p + c.el.outerHTML, '')
      // Fetch the preview view classes
      this.previewViewEl = document.getElementsByClassName('markdown-preview-view markdown-rendered')[0]
      this.css = [...Array.from(document.styleSheets)].map(x => {
        try {
          return [...Array.from(x.cssRules)].map(x => x.cssText).join('')
        } catch (e) {
          console.log(e)
          return ''
        }
      }).filter(Boolean).join('').replace(/\n/g, '')
    } catch (e) {
      console.log(e)
      this.status.hide()
      new StatusMessage('Failed to parse current note, check console for details', StatusType.Error)
      return
    }
    if (!this.content) {
      this.status.hide()
      new StatusMessage('Failed to read current note, please try again', StatusType.Error)
      return
    }

    // Reset the view to the original mode
    // The timeout is required, even though we 'await' the preview mode setting earlier
    setTimeout(() => { this.leaf.setViewState(startMode) }, 400)

    const file = this.plugin.app.workspace.getActiveFile()
    if (!(file instanceof TFile)) {
      // No active file
      this.status.hide()
      new StatusMessage('There is no active file to share')
      return
    }
    this.meta = this.plugin.app.metadataCache.getFileCache(file)
    this.outputFile = new Template()

    // Make template value replacements
    this.outputFile.setReadingWidth(this.plugin.settings.noteWidth)
    this.outputFile.setPreviewViewClasses(this.previewViewEl.classList || [])
    this.outputFile.setBodyClasses(document.body.classList)
    this.outputFile.setBodyStyle(document.body.style.cssText.replace(/"/g, '\''))
    if (!this.plugin.settings.showFooter) {
      this.outputFile.removeFooter()
    }
    this.outputFile.setThemeMode(this.plugin.settings.themeMode) // must be after setBodyClasses
    // Copy classes and styles
    this.outputFile.copyClassesAndStyles('markdown-preview-view markdown-rendered', document)
    this.outputFile.copyClassesAndStyles('markdown-preview-pusher', document)

    // Generate the HTML file for uploading
    this.dom = new DOMParser().parseFromString(this.content, 'text/html')
    if (this.plugin.settings.removeYaml) {
      // Remove frontmatter to avoid sharing unwanted data
      this.dom.querySelector('div.metadata-container')?.remove()
      this.dom.querySelector('pre.frontmatter')?.remove()
      this.dom.querySelector('div.frontmatter-container')?.remove()
    }

    // Replace links
    for (const el of this.dom.querySelectorAll<HTMLElement>('a.internal-link')) {
      const href = el.getAttribute('href')
      const match = href ? href.match(/^([^#]+)/) : null
      if (href?.match(/^#/)) {
        // Anchor link to a document heading, we need to add custom Javascript to jump to that heading
        const selector = `[data-heading="${href.slice(1)}"]`
        if (document.querySelectorAll(selector)?.[0]) {
          el.setAttribute('onclick', `document.querySelectorAll('${selector}')[0].scrollIntoView(true)`)
        }
        el.removeAttribute('target')
        el.removeAttribute('href')
        continue
      } else if (match) {
        // A link to another note - check to see if we can link to an already shared note
        const linkedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(match[1], '')
        if (linkedFile instanceof TFile) {
          const linkedMeta = this.plugin.app.metadataCache.getFileCache(linkedFile)
          if (linkedMeta?.frontmatter?.[this.field(YamlField.link)]) {
            // This file is shared, so update the link with the share URL
            el.setAttribute('href', linkedMeta.frontmatter[this.field(YamlField.link)])
            el.removeAttribute('target')
            continue
          }
        }
      }
      // This file is not shared, so remove the link and replace with the non-link content
      el.replaceWith(el.innerHTML)
    }
    for (const el of this.dom.querySelectorAll<HTMLElement>('a.external-link')) {
      // Remove target=_blank from external links
      el.removeAttribute('target')
    }

    // Process CSS and images
    await this.uploadCss()
    await this.processImages()

    // Check for MathJax
    if (this.dom.body.innerHTML.match(/<mjx-container/)) {
      this.outputFile.enableMathJax()
    }

    /*
     * Encrypt the note contents
     */

    // Use previous name and key if they exist, so that links will stay consistent across updates
    let shareName
    let decryptionKey = ''
    if (this.meta?.frontmatter?.[this.field(YamlField.link)]) {
      const match = this.meta.frontmatter[this.field(YamlField.link)].match(/(\w+)\.html(#.+?|)$/)
      if (match) {
        shareName = match[1]
        decryptionKey = match[2].slice(1)
      }
    }
    if (this.isEncrypted) {
      const plaintext = JSON.stringify({
        content: this.dom.body.innerHTML,
        basename: file.basename
      })
      // Encrypt the note
      const encryptedData = await encryptString(plaintext, decryptionKey)
      this.outputFile.addEncryptedData(JSON.stringify({
        ciphertext: encryptedData.ciphertext,
        iv: encryptedData.iv
      }))
      decryptionKey = encryptedData.key
    } else {
      // This is for notes shared without encryption, using the
      // share_unencrypted frontmatter property
      this.outputFile.addUnencryptedData(this.dom.body.innerHTML)
      this.outputFile.setTitle(file.basename)
      // Create a meta description preview based off the <p> elements
      const desc = Array.from(this.dom.querySelectorAll('p')).map(x => x.innerText).filter(x => !!x).join(' ').slice(0, 200) + '...'
      this.outputFile.setMetaDescription(desc)
    }

    // Share the file
    if (!shareName) {
      shareName = await this.saltedHash(Date.now().toString())
    }
    const shareFile = shareName + '.html'

    let shareLink = await this.upload({
      filename: shareFile,
      content: this.outputFile.getHtml(),
      encrypted: this.isEncrypted
    })
    // Add the decryption key to the share link
    if (shareLink && this.isEncrypted) {
      shareLink += '#' + decryptionKey
    }

    let shareMessage = 'The note has been shared'
    if (shareLink) {
      await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
        // Update the frontmatter with the share link
        frontmatter[this.field(YamlField.link)] = shareLink
        frontmatter[this.field(YamlField.updated)] = moment().format()
      })
      if (this.plugin.settings.clipboard || this.isForceClipboard) {
        // Copy the share link to the clipboard
        await navigator.clipboard.writeText(shareLink)
        shareMessage = `${shareMessage} and the link is copied to your clipboard 📋`
        this.isForceClipboard = false
      }
    }

    this.status.hide()
    new StatusMessage(shareMessage, StatusType.Success)
  }

  async upload (data: UploadData) {
    // Track the uploaded files and don't both re-uploading any duplicates
    if (!this.uploadedFiles.includes(data.filename)) {
      const url = await this.plugin.api.upload(data)
      this.uploadedFiles.push(data.filename)
      return url
    }
  }

  /**
   * Upload images encoded as base64
   */
  async processImages () {
    for (const el of this.dom.querySelectorAll('img')) {
      const src = el.getAttribute('src')
      if (!src || !src.startsWith('app://')) continue
      const srcMatch = src.match(/app:\/\/\w+\/([^?#]+)/)
      if (!srcMatch) continue
      const localFile = window.decodeURIComponent(srcMatch[1])
      const filename = (await this.saltedHash(localFile)) + '.' + localFile.split('.').pop()
      const url = await this.upload({
        filename,
        content: fs.readFileSync(localFile, { encoding: 'base64' }),
        encoding: 'base64'
      })
      el.setAttribute('src', url)
      el.removeAttribute('alt')
    }
  }

  /**
   * Upload theme CSS, unless this file has previously been shared,
   * or the user has requested a force re-upload
   */
  async uploadCss () {
    let uploadNeeded = false
    if (this.isForceUpload) {
      uploadNeeded = true
    } else {
      // Check with the server to see if we have an existing CSS file
      const res = await this.plugin.api.post('/v1/file/check-css')
      if (res?.success) {
        // There is an existing CSS file, so use that rather than uploading/replacing
        this.outputFile.setCssUrl(res.url)
        return
      }
      uploadNeeded = true
    }
    if (!uploadNeeded) {
      return
    }
    const cssNoticeText = 'Uploading theme, this may take some time, but will only happen once.'
    const cssNotice = new StatusMessage(cssNoticeText, StatusType.Info, 40000)

    // Extract any attachments from the CSS.
    // Will use the mime-type whitelist to determine which attachments to extract.
    const attachments = this.css.match(/url\s*\(.*?\)/g) || []
    let count = 0
    const total = attachments.length + 1 // add 1 for the CSS file itself
    for (const attachment of attachments) {
      const assetMatch = attachment.match(/url\s*\(\s*["']*(.*?)\s*["']*\s*\)/)
      const assetUrl = assetMatch?.[1] || ''
      if (assetUrl.startsWith('data:')) {
        // Base64 encoded inline attachment, we will leave this inline for now
        // const base64Match = /url\s*\(\W*data:([^;,]+)[^)]*?base64\s*,\s*([A-Za-z0-9/=+]+).?\)/
      } else if (assetMatch && assetUrl && !assetUrl.startsWith('http')) {
        // Locally stored CSS attachment
        try {
          const filename = assetUrl.match(/([^/\\]+)\.(\w+)$/)
          if (filename) {
            if (cssAttachmentWhitelist[filename[2]]) {
              // Download the attachment content
              const res = await fetch(assetUrl)
              // Reupload to the server
              const uploadUrl = await this.upload({
                filename: (await this.saltedHash(assetUrl)) + '.' + filename[2],
                content: arrayBufferToBase64(await res.arrayBuffer()),
                encoding: 'base64'
              })
              this.css = this.css.replace(assetMatch[0], `url("${uploadUrl}")`)
            }
          }
        } catch (e) {
          // Unable to download the attachment
          console.log(e)
        }
      }
      count++
      await new Promise(resolve => setTimeout(resolve, 60))
      cssNotice.setMessage(cssNoticeText + `\n\nUploaded ${count} of ${total} theme files`)
    }
    // Upload the main CSS file
    cssNotice.setMessage(cssNoticeText + `\n\nUploaded ${total - 1} of ${total} theme files`)
    const cssUrl = await this.upload({
      filename: this.plugin.settings.uid + '.css',
      content: this.css
    })
    this.outputFile.setCssUrl(cssUrl)
    cssNotice.hide()
  }

  /**
   * Turn the font mime-type into an extension.
   * @param {string} mimeType
   * @return {string|undefined}
   */

  /* extensionFromMime (mimeType: string) {
    const mimes = cssAttachmentWhitelist
    return Object.keys(mimes).find(x => mimes[x].includes((mimeType || '').toLowerCase()))
  } */

  /**
   * Force all related assets to upload again
   */
  forceUpload () {
    this.isForceUpload = true
  }

  /**
   * Copy the shared link to the clipboard, regardless of the user setting
   */
  forceClipboard () {
    this.isForceClipboard = true
  }

  /**
   * Enable/disable encryption for the note
   */
  shareAsPlainText (isPlainText: boolean) {
    this.isEncrypted = !isPlainText
  }

  /**
   * A wrapper for hash() which always adds the salt
   * @param value
   */
  async saltedHash (value: string): Promise<string> {
    return hash(this.plugin.settings.uid + value)
  }
}
