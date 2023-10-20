import {
  CachedMetadata,
  Component,
  FileSystemAdapter,
  MarkdownRenderer,
  moment,
  requestUrl,
  TFile,
  WorkspaceLeaf
} from 'obsidian'
import { encryptString, sha1 } from './crypto'
import SharePlugin from './main'
import StatusMessage, { StatusType } from './StatusMessage'
import NoteTemplate, { ElementStyle, getElementStyle } from './NoteTemplate'
import { ThemeMode, TitleSource, YamlField } from './settings'
import { dataUriToBuffer } from 'data-uri-to-buffer'
import FileTypes from './libraries/FileTypes'
import { parseExistingShareUrl } from './api'

const cssAttachmentWhitelist: { [key: string]: string[] } = {
  ttf: ['font/ttf', 'application/x-font-ttf', 'application/x-font-truetype', 'font/truetype'],
  otf: ['font/otf', 'application/x-font-opentype'],
  woff: ['font/woff', 'application/font-woff', 'application/x-font-woff'],
  woff2: ['font/woff2', 'application/font-woff2', 'application/x-font-woff2'],
  svg: ['image/svg+xml']
}

export interface SharedUrl {
  filename: string
  decryptionKey: string
  url: string
}

export interface SharedNote extends SharedUrl {
  file: TFile
}

export default class Note {
  plugin: SharePlugin
  leaf: WorkspaceLeaf
  status: StatusMessage
  css: string
  cssRules: CSSRule[]
  contentDom: HTMLDivElement
  previewDom: HTMLDivElement
  meta: CachedMetadata | null
  isEncrypted = true
  isForceUpload = false
  isForceClipboard = false
  isUploadCss = false
  template: NoteTemplate
  elements: ElementStyle[]

  constructor (plugin: SharePlugin) {
    this.plugin = plugin
    this.leaf = this.plugin.app.workspace.getLeaf()
    this.template = new NoteTemplate()
    this.elements = []
  }

  /**
   * Return the name (key) of a frontmatter property, eg 'share_link'
   * @param key
   * @return {string} The name (key) of a frontmatter property
   */
  field (key: YamlField) {
    return this.plugin.field(key)
  }

  async share () {
    // Create a semi-permanent status notice which we can update
    this.status = new StatusMessage('Sharing note...', StatusType.Default, 60 * 1000)

    if (!this.plugin.settings.apiKey) {
      this.plugin.authRedirect('share').then()
      window.open(this.plugin.settings.server + '/v1/account/get-key?id=' + this.plugin.settings.uid)
      return
    }

    // Get the active file
    const activeNote = this.plugin.app.workspace.getActiveFile()
    if (!(activeNote instanceof TFile)) {
      // No active file
      this.status.hide()
      new StatusMessage('There is no active note to share')
      return
    }
    this.meta = this.plugin.app.metadataCache.getFileCache(activeNote)

    const startMode = this.leaf.getViewState()
    const previewMode = this.leaf.getViewState()
    previewMode.state.mode = 'preview'
    await this.leaf.setViewState(previewMode)
    await new Promise(resolve => setTimeout(resolve, 300))
    // Scroll the view to the top to ensure we get the default margins for .markdown-preview-pusher
    // @ts-ignore // 'view.previewMode'
    this.leaf.view.previewMode.applyScroll(0)
    // Even though we 'await', sometimes the view isn't ready. This helps reduce no-content errors
    await new Promise(resolve => setTimeout(resolve, 200))
    try {
      // Take a copy of the Preview view DOM
      this.previewDom = document.createElement('div')
      // @ts-ignore - view.modes
      this.previewDom.innerHTML = this.leaf.view.modes.preview.containerEl.innerHTML
      // Copy classes and styles
      this.elements.push(getElementStyle('html', document.documentElement))
      this.elements.push(getElementStyle('body', document.body))
      const previewEl = this.previewDom.querySelector('.markdown-preview-view.markdown-rendered')
      if (previewEl) this.elements.push(getElementStyle('preview', previewEl as HTMLElement))
      const pusherEl = this.previewDom.querySelector('.markdown-preview-pusher')
      if (pusherEl) this.elements.push(getElementStyle('pusher', pusherEl as HTMLElement))
      this.cssRules = []
      Array.from(document.styleSheets)
        .forEach(x => Array.from(x.cssRules)
          .forEach(rule => {
            this.cssRules.push(rule)
          }))
      this.css = this.cssRules.map(rule => rule.cssText).join('').replace(/\n/g, '')
    } catch (e) {
      console.log(e)
      this.status.hide()
      new StatusMessage('Failed to parse current note, check console for details', StatusType.Error)
      return
    }

    // @ts-ignore - previewMode
    const renderer = this.leaf.view.previewMode.renderer
    this.contentDom = document.createElement('div')
    this.contentDom.append(renderer.header.el)
    // Add plugin custom elements
    this.addPluginElement('div.obsidian-banner-wrapper')
    const contentEl = document.createElement('div')
    const content = await this.plugin.app.vault.cachedRead(activeNote)
    await MarkdownRenderer.render(this.plugin.app, content, contentEl, activeNote.path, new Component())
    this.contentDom.append(contentEl)
    this.contentDom.append(renderer.footer.el)

    // Reset the view to the original mode
    // The timeout is required, even though we 'await' the preview mode setting earlier
    setTimeout(() => { this.leaf.setViewState(startMode) }, 400)

    // Generate the HTML file for uploading
    if (this.plugin.settings.removeYaml) {
      // Remove frontmatter to avoid sharing unwanted data
      ['div.metadata-container', 'pre.frontmatter', 'div.frontmatter-container']
        .forEach(selector => {
          this.contentDom.querySelectorAll(selector).forEach(el => el.remove())
        })
    }

    // Fix callout icons
    const defaultCalloutType = this.getCalloutIcon(selectorText => selectorText === '.callout') || 'pencil'
    for (const el of this.contentDom.getElementsByClassName('callout')) {
      // Get the callout icon from the CSS. I couldn't find any way to do this from the DOM,
      // as the elements may be far down below the fold and are not populated.
      const type = el.getAttribute('data-callout')
      let icon = this.getCalloutIcon(selectorText => selectorText.includes(`data-callout="${type}"`)) || defaultCalloutType
      icon = icon.replace('lucide-', '')
      // Replace the existing icon so we:
      // a) don't get double-ups, and
      // b) have a consistent style
      const iconEl = el.querySelector('div.callout-icon')
      const svgEl = iconEl?.querySelector('svg')
      if (svgEl) {
        svgEl.outerHTML = `<svg width="16" height="16" data-share-note-lucide="${icon}"></svg>`
      }
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
    const uploadResult = await this.processMedia()
    if (!uploadResult?.css?.url) {
      this.isUploadCss = true
    }
    await this.processCss()

    /*
     * Encrypt the note contents
     */

    this.status.setStatus('Processing note...')
    // Use previous name and key if they exist, so that links will stay consistent across updates
    let decryptionKey = ''
    if (this.meta?.frontmatter?.[this.field(YamlField.link)]) {
      const match = parseExistingShareUrl(this.meta.frontmatter[this.field(YamlField.link)])
      if (match) {
        this.template.filename = match.filename
        decryptionKey = match.decryptionKey
      }
    }
    this.template.encrypted = this.isEncrypted

    // Select which source for the title
    let title
    switch (this.plugin.settings.titleSource) {
      case TitleSource['First H1']:
        title = this.contentDom.getElementsByTagName('h1')?.[0]?.innerText
        break
      case TitleSource['Frontmatter property']:
        title = this.meta?.frontmatter?.[this.field(YamlField.title)]
        break
    }
    if (!title) {
      // Fallback to basename if either of the above fail
      title = activeNote.basename
    }

    if (this.isEncrypted) {
      this.status.setStatus('Encrypting note...')
      const plaintext = JSON.stringify({
        content: this.contentDom.innerHTML,
        basename: title
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
      this.template.content = this.contentDom.innerHTML
      this.template.title = title
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
      this.elements
        .filter(x => x.element === 'body')
        .forEach(item => {
          // Remove the existing theme setting
          item.classes = item.classes.filter(cls => cls !== 'theme-dark' && cls !== 'theme-light')
          // Add the preferred theme setting (dark/light)
          item.classes.push('theme-' + ThemeMode[this.plugin.settings.themeMode].toLowerCase())
        })
    }
    this.template.elements = this.elements
    // Check for MathJax
    this.template.mathJax = !!this.contentDom.innerHTML.match(/<mjx-container/)

    // Share the file
    this.status.setStatus('Uploading note...')
    let shareLink = await this.plugin.api.createNote(this.template)
    requestUrl(shareLink).then().catch() // Fetch the uploaded file to pull it through the cache

    // Add the decryption key to the share link
    if (shareLink && this.isEncrypted) {
      shareLink += '#' + decryptionKey
    }

    let shareMessage = 'The note has been shared'
    if (shareLink) {
      await this.plugin.app.fileManager.processFrontMatter(activeNote, (frontmatter) => {
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
   * Upload media attachments
   */
  async processMedia () {
    const elements = ['img', 'video']
    this.status.setStatus('Processing attachments...')
    for (const el of this.contentDom.querySelectorAll(elements.join(','))) {
      const src = el.getAttribute('src')
      if (!src || !src.startsWith('app://')) continue
      const srcMatch = src.match(/app:\/\/\w+\/([^?#]+)/)
      if (!srcMatch) continue
      const localFile = window.decodeURIComponent(srcMatch[1])
      const content = await FileSystemAdapter.readLocalFile(localFile)
      const hash = await sha1(content)
      const filetype = localFile.split('.').pop()
      if (filetype) {
        this.plugin.api.queueUpload({
          data: {
            filetype,
            hash,
            content,
            byteLength: content.byteLength
          },
          callback: (url) => el.setAttribute('src', url)
        })
      }
      el.removeAttribute('alt')
    }
    return this.plugin.api.processQueue(this.status)
  }

  /**
   * Upload theme CSS, unless this file has previously been shared,
   * or the user has requested a force re-upload
   */
  async processCss () {
    // Upload the main CSS file only if the user has asked for it.
    // We do it this way to ensure that the CSS the user wants on the server
    // stays that way, until they ASK to overwrite it.
    if (this.isForceUpload || this.isUploadCss) {
      // Extract any attachments from the CSS.
      // Will use the mime-type whitelist to determine which attachments to extract.
      this.status.setStatus('Processing CSS...')
      const attachments = this.css.match(/url\s*\(.*?\)/g) || []
      for (const attachment of attachments) {
        const assetMatch = attachment.match(/url\s*\(\s*"*(.*?)\s*(?<!\\)"\s*\)/)
        if (!assetMatch) continue
        const assetUrl = assetMatch?.[1] || ''
        if (assetUrl.startsWith('data:')) {
          // Attempt to parse the data URL
          const parsed = dataUriToBuffer(assetUrl)
          if (parsed?.type) {
            if (parsed.type === 'application/octet-stream') {
              // Attempt to get type from magic bytes
              const decoded = FileTypes.getFromSignature(parsed.buffer)
              if (!decoded) continue
              parsed.type = decoded.mimetype
            }
            const filetype = this.extensionFromMime(parsed.type)
            if (filetype) {
              const hash = await sha1(parsed.buffer)
              this.plugin.api.queueUpload({
                data: {
                  filetype,
                  hash,
                  content: parsed.buffer,
                  byteLength: parsed.buffer.byteLength
                },
                callback: (url) => { this.css = this.css.replace(assetMatch[0], `url("${url}")`) }
              })
            }
          }
        } else if (assetUrl && !assetUrl.startsWith('http')) {
          // Locally stored CSS attachment
          const filename = assetUrl.match(/([^/\\]+)\.(\w+)$/)
          if (filename) {
            if (cssAttachmentWhitelist[filename[2]]) {
              // Fetch the attachment content
              const res = await fetch(assetUrl)
              // Reupload to the server
              const contents = await res.arrayBuffer()
              const hash = await sha1(contents)
              this.plugin.api.queueUpload({
                data: {
                  filetype: filename[2],
                  hash,
                  content: contents,
                  byteLength: contents.byteLength
                },
                callback: (url) => { this.css = this.css.replace(assetMatch[0], `url("${url}")`) }
              })
            }
          }
        }
      }
      this.status.setStatus('Uploading CSS attachments...')
      await this.plugin.api.processQueue(this.status, 'CSS attachment')
      this.status.setStatus('Uploading CSS...')
      const cssHash = await sha1(this.css)
      try {
        await this.plugin.api.upload({
          filetype: 'css',
          hash: cssHash,
          content: this.css,
          byteLength: this.css.length
        })

        // Store the CSS theme in the settings
        // @ts-ignore - customCss is not exposed
        this.plugin.settings.theme = this.plugin.app?.customCss?.theme || ''
        await this.plugin.saveSettings()
      } catch (e) { }
    }
  }

  getCalloutIcon (test: (selectorText: string) => boolean) {
    const rule = this.cssRules
      .find((rule: CSSStyleRule) => rule.selectorText && test(rule.selectorText) && rule.style.getPropertyValue('--callout-icon')) as CSSStyleRule
    if (rule) {
      return rule.style.getPropertyValue('--callout-icon')
    }
    return ''
  }

  /**
   * Fetch a custom element which is added to the DOM by a plugin, and add it to our DOM
   */
  addPluginElement (selector: string) {
    const pluginElement = this.previewDom.querySelector(selector)
    if (pluginElement) this.contentDom.append(pluginElement)
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
