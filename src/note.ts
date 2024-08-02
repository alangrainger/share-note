import { CachedMetadata, moment, TFile, View, WorkspaceLeaf } from 'obsidian'
import { encryptString, sha1 } from './crypto'
import SharePlugin from './main'
import StatusMessage, { StatusType } from './StatusMessage'
import NoteTemplate, { ElementStyle, getElementStyle } from './NoteTemplate'
import { ThemeMode, TitleSource, YamlField } from './settings'
import { dataUriToBuffer } from 'data-uri-to-buffer'
import FileTypes from './libraries/FileTypes'
import { CheckFilesResult, parseExistingShareUrl } from './api'
import { minify } from 'csso'
import DurationConstructor = moment.unitOfTime.DurationConstructor
import * as path from 'path'

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
    previewMode.state.mode = 'preview'
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
      this.css = this.cssRules.map(rule => rule.cssText).join('').replace(/\n/g, '')
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
            el.setAttribute('href', linkedMeta?.frontmatter?.[this.field(YamlField.link)])
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

    // Note options
    this.expiration = this.getExpiration()

    // Process CSS and images
    const uploadResult = await this.processMedia()
    this.cssResult = uploadResult.css
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
        ciphertext: encryptedData.ciphertext,
        iv: encryptedData.iv
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

    // Share the file
    this.status.setStatus('Uploading note...')
    let shareLink = await this.plugin.api.createNote(this.template, this.expiration)

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
   * Upload media attachments
   */
  async processMedia () {
    const elements = ['img', 'video']
    this.status.setStatus('Processing attachments...')
    for (const el of this.contentDom.querySelectorAll(elements.join(','))) {
      const src = el.getAttribute('src')
      if (!src) continue

      if (src.startsWith('http') && !src.match(/^https?:\/\/localhost/)) {
        // This is a web asset, no need to upload
        continue
      }

      let content
      try {
        const res = await fetch(src)
        if (res && res.status === 200) {
          content = await res.arrayBuffer()
        }
      } catch (e) {
        // Unable to process this file
        continue
      }

      const parsed = new URL(src)
      const filetype = path.extname(parsed.pathname)?.slice(1)
      if (filetype && content) {
        const hash = await sha1(content)
        await this.plugin.api.queueUpload({
          data: {
            filetype,
            hash,
            content,
            byteLength: content.byteLength,
            expiration: this.expiration
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
    if (this.isForceUpload || !this.cssResult) {
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
      const cssHash = await sha1(minified)
      try {
        if (cssHash !== this.cssResult?.hash) {
          await this.plugin.api.upload({
            filetype: 'css',
            hash: cssHash,
            content: minified,
            byteLength: minified.length,
            expiration: this.expiration
          })
        }

        // Store the CSS theme in the settings
        // @ts-ignore
        this.plugin.settings.theme = this.plugin.app?.customCss?.theme || '' // customCss is not exposed
        await this.plugin.saveSettings()
      } catch (e) {
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
