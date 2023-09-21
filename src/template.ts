// noinspection CssInvalidPropertyValue,HtmlRequiredLangAttribute,HtmlUnknownTarget

import { ThemeMode } from './settings'

/**
 * CSS info:
 *
 * .reading-view-extra gives a custom width for the note text.
 * .status-bar makes the status bar pinned to the right, rather than full-page.
 */
const html = `
<!DOCTYPE HTML>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title></title>
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <style>
    html,
    body {
      overflow: visible !important;
    }

    .view-content {
      height: 100% !important;
    }

    .status-bar {
      position: fixed !important;
    }
  </style>
</head>
<body>
  <div class="app-container">
    <div class="horizontal-main-container">
      <div class="workspace">
        <div class="workspace-split mod-vertical mod-root">
          <div class="workspace-leaf mod-active">
            <div class="workspace-leaf-content">
              <div class="view-content">
                <div class="markdown-reading-view reading-view-extra">
                  <div id="template-preview-view">
                    <div id="template-user-data" class="markdown-preview-sizer markdown-preview-section">
                      <!-- Note content will be injected here -->
                      Encrypted note
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div id="template-footer" class="status-bar">
      <div class="status-bar-item">
        <span class="status-bar-item-segment">Published with <a href="https://obsidianshare.com/" target="_blank">Share Note</a> for Obsidian</span>
      </div>
    </div>
  </div>
  <div id="encrypted-data" style="display: none"></div>
  <script>
    // Add/remove mobile classes depending on viewport size
    function toggleMobileClasses () {
      const mobileClasses = ['is-mobile', 'is-phone']
      if (window.innerWidth <= 768) {
        // Is mobile
        document.body.classList.add(...mobileClasses)
      } else {
        document.body.classList.remove(...mobileClasses)
      }
    }
    window.addEventListener('resize', toggleMobileClasses )
    toggleMobileClasses()
  
    function base64ToArrayBuffer(base64) {
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      return bytes.buffer
    }

    async function decryptString({ ciphertext, iv }, secret) {
      const ivBuf = base64ToArrayBuffer(iv)
      const aesKey = await window.crypto.subtle.importKey('raw', base64ToArrayBuffer(secret), {
        name: 'AES-GCM',
        length: 256
      }, false, ['decrypt'])

      const plaintext = []
      for (const ciphertextChunk of ciphertext) {
        const ciphertextBuf = base64ToArrayBuffer(ciphertextChunk)
        const plaintextChunk = await window.crypto.subtle
          .decrypt({ name: 'AES-GCM', iv: ivBuf }, aesKey, ciphertextBuf)
        plaintext.push(new TextDecoder().decode(plaintextChunk))
      }
      return plaintext.join('')
    }

    /*
     * Decrypt the original note content
     */
    const encryptedData = document.getElementById('encrypted-data').innerText.trim()
    const payload = encryptedData ? JSON.parse(encryptedData) : ''
    const secret = window.location.hash.slice(1) // Taken from the URL # parameter
    if (payload && secret) {
      decryptString({ ciphertext: payload.ciphertext, iv: payload.iv }, secret)
        .then(text => {
          // Inject the user's data
          const data = JSON.parse(text)
          const contentEl = document.getElementById('template-user-data')
          if (contentEl) contentEl.innerHTML = data.content
          document.title = data.basename
        })
        .catch(() => {
          const contentEl = document.getElementById('template-user-data')
          if (contentEl) contentEl.innerHTML = 'Unable to decrypt using this key.'
        })
    }
  </script>
</body>
</html>
`

export default class Template {
  dom: Document

  constructor () {
    this.dom = new DOMParser().parseFromString(html, 'text/html')
  }

  getHtml () {
    return this.dom.documentElement.outerHTML
  }

  setCssUrl (url: string) {
    const el = this.dom.createElement('link')
    el.rel = 'stylesheet'
    el.href = url
    this.dom.head.appendChild(el)
  }

  setReadingWidth (width: string) {
    const style = `.reading-view-extra { max-width: ${width}; margin: 0 auto; }`
    const el = this.dom.createElement('style')
    el.textContent = style
    this.dom.head.appendChild(el)
  }

  setBodyClasses (classes: DOMTokenList) {
    this.dom.body.addClasses([...classes])
    // Remove any mobile classes if present.
    // They will be toggled by the template depending on viewport size.
    this.dom.body.removeClasses(['is-mobile', 'is-android', 'is-phone'])
  }

  setBodyStyle (style: string) {
    this.dom.body.style.cssText = style
  }

  setPreviewViewClasses (classes: DOMTokenList) {
    const el = this.dom.getElementById('template-preview-view')
    el?.addClasses([...classes])
  }

  removeFooter () {
    const el = this.dom.getElementById('template-footer')
    el?.remove()
  }

  addEncryptedData (jsonData: string) {
    const el = this.dom.getElementById('encrypted-data')
    if (el) {
      el.textContent = jsonData
    }
  }

  addUnencryptedData (plaintextHtml: string) {
    const el = this.dom.getElementById('template-user-data')
    if (el) {
      el.innerHTML = plaintextHtml
    }
  }

  setTitle (title: string) {
    this.dom.title = title
    const ogTitle = this.dom.createElement('meta')
    ogTitle.setAttribute('property', 'og:title')
    ogTitle.content = title
    this.dom.head.appendChild(ogTitle)
  }

  setMetaDescription (text: string) {
    const desc = this.dom.createElement('meta')
    const ogDesc = this.dom.createElement('meta')
    desc.name = 'description'
    desc.content = text
    ogDesc.content = text
    ogDesc.setAttribute('property', 'og:description')
    this.dom.head.appendChild(desc)
    this.dom.head.appendChild(ogDesc)
  }

  setThemeMode (mode: ThemeMode) {
    if (mode === ThemeMode['Same as theme']) {
      // Nothing to change
    } else {
      // Remove the existing theme
      this.dom.body.removeClasses(['theme-dark', 'theme-light'])
      // Add the preferred class
      this.dom.body.addClasses(['theme-' + ThemeMode[mode].toLowerCase()])
    }
  }

  enableMathJax () {
    const script = this.dom.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-chtml-full.js'
    script.async = true
    this.dom.head.appendChild(script)
  }
}
