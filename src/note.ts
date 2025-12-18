import { CachedMetadata, moment, requestUrl, TFile, View, WorkspaceLeaf } from 'obsidian'
import { encryptString, sha1 } from './crypto'
import SharePlugin from './main'
import StatusMessage, { StatusType } from './StatusMessage'
import NoteTemplate, { ElementStyle, getElementStyle } from './NoteTemplate'
import { ThemeMode, TitleSource, YamlField } from './settings'
import { dataUriToBuffer } from 'data-uri-to-buffer'
import FileTypes from './libraries/FileTypes'
import { CheckFilesResult, parseExistingShareUrl } from './api'
import { minify } from 'csso'
import { InternalLinkMethod } from './types'
import DurationConstructor = moment.unitOfTime.DurationConstructor

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

export interface PreviewSection {
  el: HTMLElement
}

export interface Renderer {
  parsing: boolean,
  pusherEl: HTMLElement,
  previewEl: HTMLElement,
  sections: PreviewSection[]
}

export interface ViewModes extends View {
  getViewType: any,
  getDisplayText: any,
  modes: {
    preview: {
      renderer: Renderer
    }
  }
}

export default class Note {
  plugin: SharePlugin
  leaf: WorkspaceLeaf
  status: StatusMessage
  css: string
  cssRules: CSSRule[]
  cssResult: CheckFilesResult['css']
  contentDom: Document
  meta: CachedMetadata | null
  isEncrypted = true
  isForceUpload = false
  isForceClipboard = false
  template: NoteTemplate
  elements: ElementStyle[]
  expiration?: number

  constructor (plugin: SharePlugin) {
    this.plugin = plugin
    // .getLeaf() doesn't return a `previewMode` property when a note is pinned,
    // so use the undocumented .getActiveFileView() which seems to work fine
    // @ts-ignore
    this.leaf = this.plugin.app.workspace.getActiveFileView()?.leaf
    this.elements = []
    this.template = new NoteTemplate()
  }

  /**
   * Return the name (key) of a frontmatter property, eg 'share_link'
   * @param key
   * @return {string} The name (key) of a frontmatter property
   */
  field (key: YamlField): string {
    return this.plugin.field(key)
  }

  async share () {
    if (!this.plugin.settings.apiKey) {
      this.plugin.authRedirect('share').then()
      return
    }

    // Create a semi-permanent status notice which we can update
    this.status = new StatusMessage('If this message is showing, please do not change to another note as the current note data is still being parsed.', StatusType.Default, 60 * 1000)

    const startMode = this.leaf.getViewState()
    const previewMode = this.leaf.getViewState()
    if (previewMode.state) {
      previewMode.state.mode = 'preview'
    }
    await this.leaf.setViewState(previewMode)
    await new Promise(resolve => setTimeout(resolve, 40))
    // Scroll the view to the top to ensure we get the default margins for .markdown-preview-pusher
    // @ts-ignore
    this.leaf.view.previewMode.applyScroll(0) // 'view.previewMode'
    await new Promise(resolve => setTimeout(resolve, 40))
    try {
      const view = this.leaf.view as ViewModes
      const renderer = view.modes.preview.renderer
      // Copy classes and styles
      this.elements.push(getElementStyle('html', document.documentElement))
      const bodyStyle = getElementStyle('body', document.body)
      bodyStyle.classes.push('share-note-plugin') // Add a targetable class for published notes
      this.elements.push(bodyStyle)
      this.elements.push(getElementStyle('preview', renderer.previewEl))
      this.elements.push(getElementStyle('pusher', renderer.pusherEl))
      this.contentDom = new DOMParser().parseFromString(await this.querySelectorAll(this.leaf.view as ViewModes), 'text/html')
      this.cssRules = []
      Array.from(document.styleSheets)
        .forEach(x => Array.from(x.cssRules)
          .forEach(rule => {
            this.cssRules.push(rule)
          }))

      // Merge all CSS rules into a string for later minifying
      this.css = this.cssRules
        .filter((rule: CSSMediaRule) => {
          /*
          Remove styles that prevent a print preview from showing on the web, thanks to @texastoland on Github
          https://github.com/alangrainger/share-note/issues/75#issuecomment-2708719828

          This removes all "@media print" rules, which in my testing doesn't appear to have any negative effect.
          Will have to revisit this if users discover issues.
          */
          return rule?.media?.[0] !== 'print'
        })
        .map(rule => rule.cssText).join('').replace(/\n/g, '')
    } catch (e) {
      console.log(e)
      this.status.hide()
      new StatusMessage('Failed to parse current note, check console for details', StatusType.Error)
      return
    }

    // Reset the view to the original mode
    // The timeout is required, even though we 'await' the preview mode setting earlier
    setTimeout(() => {
      this.leaf.setViewState(startMode)
    }, 200)

    this.status.setStatus('Processing note...')
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
    } else {
      // Frontmatter properties are weird - the DOM elements don't appear to contain any data.
      // We get the property name from the data-property-key and set that on the labelEl value,
      // then take the corresponding value from the metadataCache and set that on the valueEl value.
      this.contentDom.querySelectorAll('div.metadata-property')
        .forEach(propertyContainerEl => {
          const propertyName = propertyContainerEl.getAttribute('data-property-key')
          if (propertyName) {
            const labelEl = propertyContainerEl.querySelector('input.metadata-property-key-input')
            labelEl?.setAttribute('value', propertyName)
            const valueEl = propertyContainerEl.querySelector('div.metadata-property-value > input')
            const value = this.meta?.frontmatter?.[propertyName] || ''
            valueEl?.setAttribute('value', value)
            // Special cases for different element types
            switch (valueEl?.getAttribute('type')) {
              case 'checkbox':
                if (value) valueEl.setAttribute('checked', 'checked')
                break
            }
          }
        })
    }
    if (this.plugin.settings.removeBacklinksFooter) {
      // Remove backlinks footer
      this.contentDom.querySelector('div.embedded-backlinks')?.remove()
    } else {
      // Make backlinks clickable
      for (const el of this.contentDom.querySelectorAll<HTMLElement>('.embedded-backlinks .search-result-file-title.is-clickable')) {
        // Get the inner text, which is the name of the destination note
        const linkText = (el.querySelector('.tree-item-inner') as HTMLElement)?.innerText
        // Replace with a clickable link if possible
        if (linkText) this.internalLinkToSharedNote(linkText, el, InternalLinkMethod.ONCLICK)
      }
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
    for (const el of this.contentDom.querySelectorAll<HTMLElement>('a.internal-link, a.footnote-link')) {
      const href = el.getAttribute('href')
      const match = href ? href.match(/^([^#]+)/) : null
      if (href?.match(/^#/)) {
        // This is an Anchor link to a document heading, we need to add custom Javascript
        // to jump to that heading rather than using the normal # link
        try {
          const heading = href.slice(1).replace(/(['"])/g, '\\$1') // escape the quotes
          const linkTypes = [
            `[data-heading="${heading}"]`, // Links to a heading
            `[id="${heading}"]`,           // Links to a footnote
          ]
          linkTypes.forEach(selector => {
            if (this.contentDom.querySelectorAll(selector)?.[0]) {
              // Double-escape the double quotes (but leave single quotes single escaped)
              // It makes sense if you look at the query selector...
              el.setAttribute('onclick', `document.querySelectorAll('${selector.replace(/"/g, '\\"')}')[0].scrollIntoView(true)`)
            }
          })
          el.removeAttribute('target')
          el.removeAttribute('href')
          continue
        } catch (e) {
          console.error(e)
        }
      } else if (match) {
        if (this.internalLinkToSharedNote(match[1], el)) {
          // The internal link could be linked to another shared note
          continue
        }
      }
      // This linked note is not shared, so remove the link and replace with the non-link content
      el.replaceWith(el.innerText)
    }

    // Remove target=_blank from external links
    this.contentDom
      .querySelectorAll<HTMLElement>('a.external-link')
      .forEach(el => el.removeAttribute('target'))

    // Remove elements by user's custom CSS selectors (if any)
    this.plugin.settings.removeElements
      .split('\n').map(s => s.trim()).filter(Boolean)
      .forEach(selector => this.contentDom.querySelectorAll(selector)
        .forEach(el => el.remove()))

    // Note options
    this.expiration = this.getExpiration()

    // Process CSS and images
    const uploadResult = await this.processMedia()
    // Convert old format to new array format for compatibility
    if (uploadResult.css) {
      // Check if it's already in array format (new format)
      if (Array.isArray(uploadResult.css)) {
        // Only set if array is not empty
        this.cssResult = uploadResult.css.length > 0 ? uploadResult.css : undefined
      } else {
        // Convert old format { url, hash, urls? } to new array format
        const oldCss = uploadResult.css as any
        if (oldCss.urls && Array.isArray(oldCss.urls) && oldCss.urls.length > 0) {
          // Old format with urls array - convert to new format
          // Note: old format didn't have hash for each chunk, so we use the main hash
          this.cssResult = oldCss.urls.map((url: string) => ({
            url,
            hash: oldCss.hash || ''
          }))
        } else if (oldCss.url) {
          // Old format with single URL - convert to array with single element
          this.cssResult = [{
            url: oldCss.url,
            hash: oldCss.hash || ''
          }]
        } else {
          this.cssResult = undefined
        }
      }
    } else {
      this.cssResult = undefined
    }
    await this.processCss()

    /*
     * Encrypt the note contents
     */

    // Use previous name and key if they exist, so that links will stay consistent across updates
    let decryptionKey = ''
    if (this.meta?.frontmatter?.[this.field(YamlField.link)]) {
      const match = parseExistingShareUrl(this.meta?.frontmatter?.[this.field(YamlField.link)])
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
      title = file.basename
    }

    if (this.isEncrypted) {
      this.status.setStatus('Encrypting note...')
      const plaintext = JSON.stringify({
        content: this.contentDom.body.innerHTML,
        basename: title
      })
      // Encrypt the note
      const encryptedData = await encryptString(plaintext, decryptionKey)
      this.template.content = JSON.stringify({
        ciphertext: encryptedData.ciphertext
      })
      decryptionKey = encryptedData.key
    } else {
      // This is for notes shared without encryption, using the
      // share_unencrypted frontmatter property
      this.template.content = this.contentDom.body.innerHTML
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
    this.template.mathJax = !!this.contentDom.body.innerHTML.match(/<mjx-container/)

    // Pass CSS information to template (unified array format)
    if (this.cssResult && this.cssResult.length > 0) {
      this.template.css = this.cssResult
    }

    // Share the file
    this.status.setStatus('Uploading note...')
    let shareLink = await this.plugin.api.createNote(this.template, this.expiration)
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
    new StatusMessage(shareMessage + `<br><br><a href="${shareLink}">↗️ Open shared note</a>`, StatusType.Success, 6000)
  }

  /**
   * Upload media attachments
   */
  /**
   * Detect image/video file type from file signature (magic bytes)
   */
  detectMediaTypeFromSignature (content: ArrayBuffer): string | undefined {
    const bytes = new Uint8Array(content, 0, 12)
    
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return 'png'
    }
    
    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return 'jpg'
    }
    
    // GIF: 47 49 46 38 (GIF8)
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return 'gif'
    }
    
    // WebP: RIFF...WEBP
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      // Check for WEBP at offset 8
      if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
        return 'webp'
      }
    }
    
    // BMP: 42 4D
    if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
      return 'bmp'
    }
    
    // SVG: Check if content starts with XML/SVG markers
    const textDecoder = new TextDecoder('utf-8', { fatal: false })
    const textStart = textDecoder.decode(bytes.slice(0, 100))
    if (textStart.trim().startsWith('<?xml') || textStart.trim().startsWith('<svg')) {
      return 'svg'
    }
    
    // MP4: ftyp box at the beginning
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      return 'mp4'
    }
    
    // WebM: 1A 45 DF A3
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      return 'webm'
    }
    
    return undefined
  }

  async processMedia () {
    const elements = ['img', 'video']
    this.status.setStatus('Processing attachments...')
    for (const el of this.contentDom.querySelectorAll(elements.join(','))) {
      const src = el.getAttribute('src')
      if (!src) continue
      let content, filetype

      if (src.startsWith('http') && !src.match(/^https?:\/\/localhost/)) {
        // This is a web asset, no need to upload
        continue
      }

      const filesource = el.getAttribute('filesource')
      const isBlobUrl = src.startsWith('blob:')
      let detectedFiletype: string | undefined
      
      if (filesource?.match(/excalidraw/i)) {
        // Excalidraw drawing
        console.log('Processing Excalidraw drawing...')
        try {
          // @ts-ignore
          const excalidraw = this.plugin.app.plugins.getPlugin('obsidian-excalidraw-plugin')
          if (!excalidraw) continue
          content = await excalidraw.ea.createSVG(filesource)
          content = content.outerHTML
          filetype = 'svg'
          /*
            Or as PNG:
            const blob = await excalidraw.ea.createPNG(filesource)
            content = await blob.arrayBuffer()
            filetype = 'png'
          */
        } catch (e) {
          console.error('Unable to process Excalidraw drawing:')
          console.error(e)
          continue
        }
      } else {
        try {
          const res = await fetch(src)
          if (res && res.status === 200) {
            content = await res.arrayBuffer()
            
            // Try to detect file type from Content-Type header
            const contentType = res.headers.get('Content-Type')
            if (contentType) {
              // Extract extension from common image/video MIME types
              const mimeToExt: { [key: string]: string } = {
                'image/png': 'png',
                'image/jpeg': 'jpg',
                'image/jpg': 'jpg',
                'image/gif': 'gif',
                'image/webp': 'webp',
                'image/svg+xml': 'svg',
                'image/bmp': 'bmp',
                'video/mp4': 'mp4',
                'video/webm': 'webm',
                'video/ogg': 'ogg'
              }
              const ext = mimeToExt[contentType.split(';')[0].trim().toLowerCase()]
              if (ext) {
                detectedFiletype = ext
              }
            }
            
            // If still no filetype, try to detect from file signature
            if (!detectedFiletype && content) {
              // First try FileTypes (for fonts, SVG)
              const decoded = FileTypes.getFromSignature(content)
              if (decoded) {
                detectedFiletype = decoded.extension
              } else {
                // Then try media type detection
                detectedFiletype = this.detectMediaTypeFromSignature(content)
              }
            }
          }
        } catch (e) {
          // Unable to process this file
          continue
        }
      }

      // Try to get filetype from URL first, then fall back to detected type
      if (!filetype) {
        const parsed = new URL(src)
        filetype = parsed.pathname.split('.').pop()
      }
      
      // If filetype from URL is invalid (e.g., UUID from blob URL), use detected type
      // Valid file extensions are typically 2-5 characters and contain only alphanumeric characters
      if (!filetype || filetype.length > 10 || !/^[a-z0-9]+$/i.test(filetype)) {
        filetype = detectedFiletype
      }
      
      // For blob URLs, skip if we couldn't detect a valid media type
      if (isBlobUrl && !filetype) {
        // This blob URL doesn't contain a recognizable media file, skip it
        // (e.g., code styler plugin icons that aren't actual image files)
        continue
      }
      
      // Final check: if we still don't have a valid filetype, skip this file
      if (!filetype || !content) {
        continue
      }
      
      const hash = await sha1(content)
      await this.plugin.api.queueUpload({
        data: {
          filetype,
          hash,
          content,
          byteLength: content.byteLength || (typeof content === 'string' ? new TextEncoder().encode(content).length : 0),
          expiration: this.expiration
        },
        callback: (url) => el.setAttribute('src', url)
      })
      el.removeAttribute('alt')
    }
    return this.plugin.api.processQueue(this.status)
  }

  /**
   * Split CSS into chunks at rule boundaries to avoid breaking CSS syntax
   * @param css CSS content to split
   * @param maxChunkSize Maximum size of each chunk in bytes (default: 500KB)
   * @returns Array of CSS chunks
   */
  splitCssIntoChunks (css: string, maxChunkSize: number = 500 * 1024): string[] {
    const encoder = new TextEncoder()
    const cssBytes = encoder.encode(css)
    
    // If CSS is smaller than maxChunkSize, return as single chunk
    if (cssBytes.length <= maxChunkSize) {
      return [css]
    }
    
    const chunks: string[] = []
    let currentChunk = ''
    let currentChunkSize = 0
    let braceDepth = 0
    let inString = false
    let stringChar = ''
    let i = 0
    
    while (i < css.length) {
      const char = css[i]
      const charBytes = encoder.encode(char).length
      
      // Track string boundaries to avoid splitting inside strings
      if (!inString && (char === '"' || char === "'")) {
        inString = true
        stringChar = char
      } else if (inString && char === stringChar && css[i - 1] !== '\\') {
        inString = false
        stringChar = ''
      }
      
      // Track brace depth to find rule boundaries
      if (!inString) {
        if (char === '{') {
          braceDepth++
        } else if (char === '}') {
          braceDepth--
        }
      }
      
      currentChunk += char
      currentChunkSize += charBytes
      
      // If current chunk exceeds max size, try to split at a safe point
      if (currentChunkSize >= maxChunkSize) {
        // Prefer splitting at end of rule (braceDepth === 0, char === '}')
        if (braceDepth === 0 && !inString && char === '}') {
          chunks.push(currentChunk)
          currentChunk = ''
          currentChunkSize = 0
        } else if (currentChunkSize >= maxChunkSize * 1.5) {
          // If chunk is 1.5x larger than max, force split even if not at perfect boundary
          // This prevents extremely large chunks if CSS has very long rules
          chunks.push(currentChunk)
          currentChunk = ''
          currentChunkSize = 0
        }
      }
      
      i++
    }
    
    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk)
    }
    
    return chunks.length > 0 ? chunks : [css]
  }

  /**
   * Upload theme CSS, unless this file has previously been shared,
   * or the user has requested a force re-upload
   */
  async processCss () {
    // Upload the main CSS file only if the user has asked for it.
    // We do it this way to ensure that the CSS the user wants on the server
    // stays that way, until they ASK to overwrite it.
    // Check if cssResult is empty array or doesn't exist
    const hasCssResult = this.cssResult && this.cssResult.length > 0
    if (this.isForceUpload || !hasCssResult) {
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
              await this.plugin.api.queueUpload({
                data: {
                  filetype,
                  hash,
                  content: parsed.buffer,
                  byteLength: parsed.buffer.byteLength,
                  expiration: this.expiration
                },
                callback: (url) => {
                  this.css = this.css.replace(assetMatch[0], `url("${url}")`)
                }
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
              await this.plugin.api.queueUpload({
                data: {
                  filetype: filename[2],
                  hash,
                  content: contents,
                  byteLength: contents.byteLength,
                  expiration: this.expiration
                },
                callback: (url) => {
                  this.css = this.css.replace(assetMatch[0], `url("${url}")`)
                }
              })
            }
          }
        }
      }
      this.status.setStatus('Uploading CSS attachments...')
      await this.plugin.api.processQueue(this.status, 'CSS attachment')
      this.status.setStatus('Uploading CSS...')
      const minified = minify(this.css).css
      
      // Calculate actual byte length for UTF-8 encoded string
      const encoder = new TextEncoder()
      const cssBytes = encoder.encode(minified)
      const cssHash = await sha1(minified)
      
      try {
        // Split CSS into chunks if it's larger than 500KB to avoid blocking page load
        const CSS_CHUNK_SIZE = 500 * 1024 // 500KB per chunk
        const chunks = this.splitCssIntoChunks(minified, CSS_CHUNK_SIZE)
        const needsSplitting = chunks.length > 1
        
        const hasExistingCss = this.cssResult && this.cssResult.length > 0
        const hasExistingChunks = hasExistingCss && (this.cssResult?.length || 0) > 1
        const needsResplit = needsSplitting && !hasExistingChunks
        const hashChanged = !hasExistingCss || cssHash !== (this.cssResult?.[0]?.hash)
        
        
        // Upload if hash changed, needs resplit, or force upload
        if (hashChanged || needsResplit || this.isForceUpload) {
          if (needsSplitting) {
            // Upload multiple CSS chunks
            this.status.setStatus(`Uploading CSS chunks (${chunks.length} files)...`)
            const cssFiles: Array<{ url: string; hash: string }> = []
            
            for (let i = 0; i < chunks.length; i++) {
              const chunk = chunks[i]
              const chunkBytes = encoder.encode(chunk)
              
              const chunkContentHash = await sha1(chunk)
              
              // Generate unique hash for filename generation (includes chunk index to ensure uniqueness)
              const chunkHashForFilename = await sha1(`${i + 1}-${chunkContentHash}-${chunks.length}`)
              
              this.status.setStatus(`Uploading CSS chunk ${i + 1} of ${chunks.length}...`)
              const chunkUrl = await this.plugin.api.upload({
                filetype: 'css',
                hash: chunkHashForFilename, // Unique hash for filename generation
                content: chunk, // Original CSS content
                byteLength: chunkBytes.length,
                expiration: this.expiration
              })
              
              if (chunkUrl) {
                cssFiles.push({
                  url: chunkUrl,
                  hash: chunkContentHash
                })
                const chunkSizeKB = (chunkBytes.length / 1024).toFixed(2)
                this.status.setStatus(`CSS chunk ${i + 1}/${chunks.length} uploaded: ${chunkUrl} (${chunkSizeKB} KB)`)
              }
            }
            
            this.cssResult = cssFiles
          } else {
            // Single CSS file (small enough, use array with single element)
            if (hashChanged) {
              const singleCssUrl = await this.plugin.api.upload({
                filetype: 'css',
                hash: cssHash,
                content: minified,
                byteLength: cssBytes.length,
                expiration: this.expiration
              })
              
              if (singleCssUrl) {
                const cssSizeKB = (cssBytes.length / 1024).toFixed(2)
                this.status.setStatus(`CSS uploaded: ${singleCssUrl} (${cssSizeKB} KB)`)
                this.cssResult = [{
                  url: singleCssUrl,
                  hash: cssHash
                }]
              }
            }
          }
        }

        // Store the CSS theme in the settings
        // @ts-ignore
        this.plugin.settings.theme = this.plugin.app?.customCss?.theme || '' // customCss is not exposed
        await this.plugin.saveSettings()
      } catch (e) {
        console.error('Error in processCss:', e)
      }
    }
  }

  async querySelectorAll (view: ViewModes) {
    const renderer = view.modes.preview.renderer
    let html = ''
    await new Promise<void>(resolve => {
      let count = 0
      let parsing = 0
      const timer = setInterval(() => {
        try {
          const sections = renderer.sections
          count++
          if (renderer.parsing) parsing++
          if (count > parsing) {
            // Check the final sections to see if they have rendered
            let rendered = 0
            if (sections.length > 12) {
              sections.slice(sections.length - 7, sections.length - 1).forEach((section: PreviewSection) => {
                if (section.el.innerHTML) rendered++
              })
              if (rendered > 3) count = 100
            } else {
              count = 100
            }
          }
          if (count > 40) {
            html = this.reduceSections(renderer.sections)
            resolve()
          }
        } catch (e) {
          clearInterval(timer)
          resolve()
        }
      }, 100)
    })
    return html
  }

  /**
   * Takes a linkText like 'Some note' or 'Some path/Some note.md' and sees if that note is already shared.
   * If it's already shared, then replace the internal link with the public link to that note.
   */
  internalLinkToSharedNote (linkText: string, el: HTMLElement, method: InternalLinkMethod = 0) {
    try {
      // This is an internal link to another note - check to see if we can link to an already shared note
      const linkedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkText, '')
      if (linkedFile instanceof TFile) {
        const linkedMeta = this.plugin.app.metadataCache.getFileCache(linkedFile)
        const href = linkedMeta?.frontmatter?.[this.field(YamlField.link)]
        if (href && typeof href === 'string') {
          // This file is shared, so update the link with the share URL
          if (method === InternalLinkMethod.ANCHOR) {
            // Set the href for an <a> element
            el.setAttribute('href', href)
            el.removeAttribute('target')
          } else if (method === InternalLinkMethod.ONCLICK) {
            // Add an onclick() method
            el.setAttribute('onclick', `window.location.href='${href}'`)
            el.classList.add('force-cursor')
          }
          return true
        }
      }
    } catch (e) {
      console.error(e)
    }
    return false
  }

  getCalloutIcon (test: (selectorText: string) => boolean) {
    const rule = this.cssRules
      .find((rule: CSSStyleRule) => rule.selectorText && test(rule.selectorText) && rule.style.getPropertyValue('--callout-icon')) as CSSStyleRule
    if (rule) {
      return rule.style.getPropertyValue('--callout-icon')
    }
    return ''
  }

  reduceSections (sections: { el: HTMLElement }[]) {
    return sections.reduce((p: string, c) => p + c.el.outerHTML, '')
  }

  /**
   * Turn the font mime-type into an extension.
   * @param {string} mimeType
   * @return {string|undefined}
   */
  extensionFromMime (mimeType: string): string | undefined {
    const mimes = cssAttachmentWhitelist
    return Object.keys(mimes).find(x => mimes[x].includes((mimeType || '').toLowerCase()))
  }

  /**
   * Get the value of a frontmatter property
   */
  getProperty (field: YamlField) {
    return this.meta?.frontmatter?.[this.plugin.field(field)]
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

  /**
   * Calculate an expiry datetime from the provided expiry duration
   */
  getExpiration () {
    const whitelist = ['minute', 'hour', 'day', 'month']
    const expiration = this.getProperty(YamlField.expires) || this.plugin.settings.expiry
    if (expiration) {
      // Check for sanity against expected format
      const match = expiration.match(/^(\d+) ([a-z]+?)s?$/)
      if (match && whitelist.includes(match[2])) {
        return parseInt(moment().add(+match[1], (match[2] + 's') as DurationConstructor).format('x'), 10)
      }
    }
  }
}
