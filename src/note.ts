import { CachedMetadata, moment, requestUrl, TFile, WorkspaceLeaf } from 'obsidian'
import { encryptString, sha1 } from './crypto'
import SharePlugin from './main'
import * as fs from 'fs'
import StatusMessage, { StatusType } from './StatusMessage'
import NoteTemplate, { getElementStyle } from './NoteTemplate'
import { ThemeMode } from './settings'
import { dataUriToBuffer } from 'data-uri-to-buffer'
import FileTypes from './libraries/FileTypes'

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
  css: string
  domCopy: Document
  contentDom: Document
  meta: CachedMetadata | null
  isEncrypted = true
  isForceUpload = false
  isForceClipboard = false
  uploadedFiles: string[]
  template: NoteTemplate

  constructor (plugin: SharePlugin) {
    this.plugin = plugin
    this.leaf = this.plugin.app.workspace.getLeaf()
    this.template = new NoteTemplate()
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
    // Create a semi-permanent status notice which we can update
    this.status = new StatusMessage('Sharing note...', StatusType.Default, 30 * 1000)

    if (!this.plugin.settings.apiKey) {
      window.open(this.plugin.settings.server + '/v1/account/get-key?id=' + this.plugin.settings.uid)
      return
    }

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
      // Take a clone of the DOM
      this.domCopy = new DOMParser().parseFromString(document.documentElement.outerHTML, 'text/html')
      // @ts-ignore // 'view.modes'
      const noteHtml = this.leaf.view.modes.preview.renderer.sections.reduce((p, c) => p + c.el.outerHTML, '')
      this.contentDom = new DOMParser().parseFromString(noteHtml, 'text/html')
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

    // Generate the HTML file for uploading
    if (this.plugin.settings.removeYaml) {
      // Remove frontmatter to avoid sharing unwanted data
      this.contentDom.querySelector('div.metadata-container')?.remove()
      this.contentDom.querySelector('pre.frontmatter')?.remove()
      this.contentDom.querySelector('div.frontmatter-container')?.remove()
    }

    // Replace links
    for (const el of this.contentDom.querySelectorAll<HTMLElement>('a.internal-link')) {
      const href = el.getAttribute('href')
      const match = href ? href.match(/^([^#]+)/) : null
      if (href?.match(/^#/)) {
        // Anchor link to a document heading, we need to add custom Javascript to jump to that heading
        const selector = `[data-heading="${href.slice(1)}"]`
        if (this.contentDom.querySelectorAll(selector)?.[0]) {
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
    for (const el of this.contentDom.querySelectorAll<HTMLElement>('a.external-link')) {
      // Remove target=_blank from external links
      el.removeAttribute('target')
    }

    // Process CSS and images
    await this.uploadCss()
    await this.processImages()

    /*
     * Encrypt the note contents
     */

    // Use previous name and key if they exist, so that links will stay consistent across updates
    let decryptionKey = ''
    if (this.meta?.frontmatter?.[this.field(YamlField.link)]) {
      const match = this.meta.frontmatter[this.field(YamlField.link)].match(/https:\/\/[^/]+(?:\/\w{2}|)\/(\w+).*?(#.+?|)$/)
      if (match) {
        this.template.filename = match[1]
        decryptionKey = match[2].slice(1)
      }
    }
    this.template.encrypted = this.isEncrypted
    if (this.isEncrypted) {
      const plaintext = JSON.stringify({
        content: this.contentDom.body.innerHTML,
        basename: file.basename
      })
      // Encrypt the note
      const encryptedData = await encryptString(plaintext, decryptionKey)
      this.template.content = JSON.stringify({
        ciphertext: encryptedData.ciphertext,
        iv: encryptedData.iv
      })
      decryptionKey = encryptedData.key
    } else {
      // This is for notes shared without encryption, using the
      // share_unencrypted frontmatter property
      this.template.content = this.contentDom.body.innerHTML
      this.template.title = file.basename
      // Create a meta description preview based off the <p> elements
      const desc = Array.from(this.contentDom.querySelectorAll('p'))
        .map(x => x.innerText).filter(x => !!x)
        .join(' ')
      this.template.description = desc.length > 200 ? desc.slice(0, 197) + '...' : desc
    }

    // Make template value replacements
    this.template.width = this.plugin.settings.noteWidth
    // Set theme light/dark
    if (this.plugin.settings.themeMode !== ThemeMode['Same as theme']) {
      // Remove the existing theme
      this.domCopy.body.removeClasses(['theme-dark', 'theme-light'])
      // Add the preferred class
      this.domCopy.body.addClasses(['theme-' + ThemeMode[this.plugin.settings.themeMode].toLowerCase()])
    }
    // Copy classes and styles
    this.template.elements.push(getElementStyle('body', this.domCopy.body))
    this.template.elements.push(getElementStyle('preview', this.domCopy.getElementsByClassName('markdown-preview-view markdown-rendered')[0] as HTMLElement))
    this.template.elements.push(getElementStyle('pusher', this.domCopy.getElementsByClassName('markdown-preview-pusher')[0] as HTMLElement))
    // Check for MathJax
    this.template.mathJax = !!this.contentDom.body.innerHTML.match(/<mjx-container/)

    // Share the file
    let shareLink = await this.plugin.api.createNote(this.template)
    requestUrl(shareLink).then().catch() // Fetch the uploaded file to pull it through the cache

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
        try {
          await navigator.clipboard.writeText(shareLink)
          shareMessage = `${shareMessage} and the link is copied to your clipboard 📋`
        } catch (e) {
          // If there's an error here it's because the user clicked away from the Obsidian window
        }
        this.isForceClipboard = false
      }
    }

    this.status.hide()
    new StatusMessage(shareMessage, StatusType.Success)
  }

  /**
   * Upload images encoded as base64
   */
  async processImages () {
    for (const el of this.contentDom.querySelectorAll('img')) {
      const src = el.getAttribute('src')
      if (!src || !src.startsWith('app://')) continue
      const srcMatch = src.match(/app:\/\/\w+\/([^?#]+)/)
      if (!srcMatch) continue
      const localFile = window.decodeURIComponent(srcMatch[1])
      const content = fs.readFileSync(localFile, null)
      const filetype = localFile.split('.').pop()
      if (filetype) {
        const url = await this.plugin.api.uploadBinary({
          filetype,
          hash: await sha1(content),
          content,
          byteLength: content.byteLength
        })
        el.setAttribute('src', url)
      }
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
        return
      }
      uploadNeeded = true
    }
    if (!uploadNeeded) {
      return
    }
    const cssNoticeText = 'Uploading theme, this may take some time, but will only happen once.'
    const cssNotice = new StatusMessage(cssNoticeText, StatusType.Info, 120000)

    // Extract any attachments from the CSS.
    // Will use the mime-type whitelist to determine which attachments to extract.
    const attachments = this.css.match(/url\s*\(.*?\)/g) || []
    let count = 0
    const total = attachments.length + 1 // add 1 for the CSS file itself
    for (const attachment of attachments) {
      const assetMatch = attachment.match(/url\s*\(\s*"*(.*?)\s*(?<!\\)"\s*\)/)
      if (!assetMatch) continue
      const assetUrl = assetMatch?.[1] || ''
      if (assetUrl.startsWith('data:')) {
        // Attempt to parse the data URL
        const parsed = dataUriToBuffer(assetUrl)
        if (parsed?.type) {
          if (parsed.type === 'application/octet-stream') {
            const decoded = FileTypes.getFromSignature(parsed.buffer)
            if (!decoded) continue
            console.log(decoded.mimetype)
            parsed.type = decoded.mimetype
          }
          const filetype = this.extensionFromMime(parsed.type)
          if (filetype) {
            const uploadUrl = await this.plugin.api.uploadBinary({
              filetype,
              hash: await sha1(parsed.buffer),
              content: parsed.buffer,
              byteLength: parsed.buffer.byteLength
            })
            this.css = this.css.replace(assetMatch[0], `url("${uploadUrl}")`)
          }
        }
        // console.log(parsed)
      } else if (assetUrl && !assetUrl.startsWith('http')) {
        // Locally stored CSS attachment
        try {
          const filename = assetUrl.match(/([^/\\]+)\.(\w+)$/)
          if (filename) {
            if (cssAttachmentWhitelist[filename[2]]) {
              // Download the attachment content
              const res = await fetch(assetUrl)
              // Reupload to the server
              const contents = await res.arrayBuffer()
              const uploadUrl = await this.plugin.api.uploadBinary({
                filetype: filename[2],
                hash: await sha1(contents),
                content: contents,
                byteLength: contents.byteLength
              })
              this.css = this.css.replace(assetMatch[0], `url("${uploadUrl}")`)
            }
          }
        } catch (e) {
          // Unable to upload the attachment
          console.log(e)
        }
      }
      count++
      await new Promise(resolve => setTimeout(resolve, 60))
      cssNotice.setMessage(cssNoticeText + `\n\nUploaded ${count} of ${total} theme files`)
    }
    // Upload the main CSS file
    cssNotice.setMessage(cssNoticeText + `\n\nUploaded ${total - 1} of ${total} theme files`)
    await this.plugin.api.upload({
      filetype: 'css',
      hash: await sha1(this.css),
      content: this.css,
      byteLength: this.css.length
    })
    cssNotice.hide()
  }

  /**
   * Turn the font mime-type into an extension.
   * @param {string} mimeType
   * @return {string|undefined}
   */

  extensionFromMime (mimeType: string) {
    const mimes = cssAttachmentWhitelist
    return Object.keys(mimes).find(x => mimes[x].includes((mimeType || '').toLowerCase()))
  }

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
}
