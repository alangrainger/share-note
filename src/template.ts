export const Placeholder = {
  title: 'TEMPLATE_TITLE',
  css: 'TEMPLATE_STYLESHEET',
  noteWidth: 'TEMPLATE_WIDTH',
  bodyClass: 'TEMPLATE_BODY_CLASS',
  bodyStyle: 'TEMPLATE_BODY_STYLE',
  previewViewClass: 'TEMPLATE_PREVIEW_VIEW_CLASS',
  payload: 'TEMPLATE_ENCRYPTED_DATA',
  footer: 'TEMPLATE_FOOTER'
}

/**
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
    <link rel="icon" type="image/x-icon" href="favicon.ico">
    <link rel="stylesheet" href="TEMPLATE_STYLESHEET">
    <style>
        html, body {
            overflow: visible !important;
        }

        .view-content {
            height: 100% !important;
        }

        .reading-view-extra {
            max-width: TEMPLATE_WIDTH;
            margin: 0 auto;
        }
        
        .status-bar {
            position: fixed !important;
        }
    </style>
</head>
<body>
<body class="TEMPLATE_BODY_CLASS" style="TEMPLATE_BODY_STYLE">
<div class="app-container">
    <div class="horizontal-main-container">
        <div class="workspace">
            <div class="workspace-split mod-vertical mod-root">
                <div class="workspace-leaf mod-active">
                    <div class="workspace-leaf-content">
                        <div class="view-content">
                            <div class="markdown-reading-view reading-view-extra">
                                <div class="TEMPLATE_PREVIEW_VIEW_CLASS">
                                    <div id="template-user-data"
                                         class="markdown-preview-sizer markdown-preview-section">
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
    TEMPLATE_FOOTER
</div>
<div id="encrypted-data" style="display: none;">
    TEMPLATE_ENCRYPTED_DATA
</div>
<script>
  function base64ToArrayBuffer (base64) {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  async function decryptString ({ ciphertext, iv }, secret) {
    const ciphertextBuf = base64ToArrayBuffer(ciphertext)
    const ivBuf = base64ToArrayBuffer(iv)
    const aesKey = await window.crypto.subtle.importKey('raw', base64ToArrayBuffer(secret), {
      name: 'AES-GCM',
      length: 256
    }, false, ['decrypt'])
    const plaintext = await window.crypto.subtle
      .decrypt({ name: 'AES-GCM', iv: ivBuf }, aesKey, ciphertextBuf)
    return new TextDecoder().decode(plaintext)
  }

  /*
   * Decrypt the original note content
   */
  const payload = JSON.parse(document.getElementById('encrypted-data').innerText)
  const secret = window.location.hash.slice(1) // Taken from the URL # parameter
  if (secret) {
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

export const defaultFooter = `
<div class="status-bar">
        <div class="status-bar-item">
            <span class="status-bar-item-segment">Published with <a
                    href="https://obsidianshare.com/" target="_blank">Share Note</a> for Obsidian</span>
        </div>
    </div>`

export default class Template {
  html: string
  footer: string

  constructor () {
    this.html = html
  }

  set (key: string, value: string) {
    this.html = this.html.replace(new RegExp(key, 'g'), value)
  }
}
