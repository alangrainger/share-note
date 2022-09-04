const UPLOAD_LOCATION = 'https://example.com/somepath/' // the web root where the files will be uploaded. End in a trailing slash.
const UPLOAD_ENDPOINT = 'upload.php' // path to the upload endpoint, relative to UPLOAD_LOCATION
const YAML_FIELD = 'share'
const SECRET = 'some_fancy_secret'
const WIDTH = 700

/*
 * Obsidian Share
 * 
 * Created by Alan Grainger
 * https://github.com/alangrainger/obsidian-share/
 * 
 * v1.1.0
 */

const fs = require('fs')
const leaf = app.workspace.activeLeaf
const startMode = leaf.getViewState()

// Switch to Preview mode
const previewMode = leaf.getViewState()
previewMode.state.mode = 'preview'
leaf.setViewState(previewMode)
await new Promise(resolve => { setTimeout(() => { resolve() }, 200) })

// Parse the current document
let content, body, previewView, css
try {
    content = leaf.view.modes.preview.renderer.sections.reduce((p, c) => p + c.el.innerHTML, '')
    body = document.getElementsByTagName('body')[0]
    previewView = document.getElementsByClassName('markdown-preview-view markdown-rendered')[0]
    css = [...document.styleSheets].map(x => {
        try { return [...x.cssRules].map(x => x.cssText).join('') }
        catch (e) { }
    }).filter(Boolean).join('').replace(/\n/g, '')
} catch (e) {
    console.log(e)
    new Notice('Failed to parse current note, check console for details', 5000)
}
// Revert to the original view mode
setTimeout(() => { leaf.setViewState(startMode) }, 200)
if (!previewView) return // Failed to parse current note

async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
const getHash = async (path) => { return (await sha256(path)).slice(0, 32) }

function updateFrontmatter(contents, field, value) {
    const f = contents.match(/^---\r?\n(.*?)\n---\r?\n(.*)$/s),
        v = `${field}: ${value}`,
        x = new RegExp(`^${field}:.*$`, 'm'),
        [s, e] = f ? [`${f[1]}\n`, f[2]] : ['', contents]
    return f && f[1].match(x) ? contents.replace(x, v) : `---\n${s}${v}\n---\n${e}`
}

/**
 * Upload to web server
 * Will add two new properties to the POST data:
 * 'nonce' - here using millisecond timestamp
 * 'auth' - SHA256 of nonce + SECRET
 * @param {Object} data - An object with the following properties:
 * @param {string} data.filename - Filename for the destination file
 * @param {string} data.content - File content
 * @param {string} [data.encoding] - Optional encoding type, accepts only 'base64'
 */
async function upload(data) {
    data.nonce = Date.now().toString()
    data.auth = await sha256(data.nonce + SECRET)
    await requestUrl({ url: UPLOAD_LOCATION + UPLOAD_ENDPOINT, method: 'POST', body: JSON.stringify(data) })
}

/**
 * Convert mime-type to file extension
 * If you want any additional base64 encoded files to be extracted from your CSS,
 * add the extension and mime-type(s) here.
 * @param {string} mimeType
 * @returns {string} File extension
 */
function extension(mimeType) {
    const mimes = {
        ttf: ['font/ttf', 'application/x-font-ttf', 'application/x-font-truetype', 'font/truetype'],
        otf: ['font/otf', 'application/x-font-opentype'],
        woff: ['font/woff', 'application/font-woff', 'application/x-font-woff'],
        woff2: ['font/woff2', 'application/font-woff2', 'application/x-font-woff2'],
    }
    return Object.keys(mimes).find(x => mimes[x].includes((mimeType || '').toLowerCase()))
}

const file = app.workspace.getActiveFile()
let html = `
<!DOCTYPE HTML>
<html>
<head>
    <title>${file.basename}</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="style.css">
</head>
<body class="${body.className}" style="${body.style.cssText.replace(/"/g, `'`)}">
<div class="app-container">
<div class="horizontal-main-container">
<div class="workspace">
<div class="workspace-split mod-vertical mod-root">
<div class="workspace-leaf mod-active">
<div class="workspace-leaf-content">
<div class="view-content">
<div class="markdown-reading-view" style="max-width:${WIDTH}px;margin: 0 auto;">
<div class="${previewView.className}">
<div class="markdown-preview-sizer markdown-preview-section">
${content}
</div></div></div></div></div></div></div></div></div></body></html>`

try {
    // Generate the HTML file for uploading
    const dom = new DOMParser().parseFromString(html, 'text/html')
    // Remove frontmatter to avoid sharing unwanted data
    dom.querySelector('pre.frontmatter')?.remove()
    dom.querySelector('div.frontmatter-container')?.remove()
    // Replace links
    for (const el of dom.querySelectorAll("a.internal-link")) {
        if (href = el.getAttribute('href').match(/^([^#]+)/)) {
            const file = app.metadataCache.getFirstLinkpathDest(href[1], '')
            const meta = app.metadataCache.getFileCache(file)
            if (meta?.frontmatter?.[YAML_FIELD + '_link']) {
                // This file is shared, so update the link with the share URL
                el.setAttribute('href', meta.frontmatter[YAML_FIELD + '_link'])
                el.removeAttribute('target')
                continue
            }
        }
        // This file is not shared, so remove the link and replace with plain-text
        el.replaceWith(el.innerText)
    }
    // Upload local images
    for (const el of dom.querySelectorAll('img')) {
        const src = el.getAttribute('src')
        if (!src.startsWith('app://')) continue
        try {
            const localFile = window.decodeURIComponent(src.match(/app:\/\/local\/([^?#]+)/)[1])
            const url = (await getHash(localFile)) + '.' + localFile.split('.').pop()
            el.setAttribute('src', url)
            el.removeAttribute('alt')
            upload({ filename: url, content: fs.readFileSync(localFile, { encoding: 'base64' }), encoding: 'base64' })
        } catch (e) {
            console.log(e)
        }
    }
    // Share the file
    const shareFile = (await getHash(file.path)) + '.html'
    upload({ filename: shareFile, content: dom.documentElement.innerHTML })
    // Upload theme CSS, unless this file has previously been shared
    // To force a CSS re-upload, just remove the `share_link` frontmatter field
    if (!app.metadataCache.getFileCache(file)?.frontmatter?.[YAML_FIELD + '_link']) {
        // Extract any base64 encoded attachments from the CSS.
        // Will use the mime-type list above to determine which attachments to extract.
        const regex = /url\s*\(\W*data:([^;,]+)[^)]*?base64\s*,\s*([A-Za-z0-9/=+]+).?\)/
        for (const attachment of css.match(new RegExp(regex, 'g')) || []) {
            if (match = attachment.match(new RegExp(regex))) {
                if (extension(match[1])) {
                    const filename = (await getHash(match[2])) + `.${extension(match[1])}`
                    css = css.replace(match[0], `url("${filename}")`)
                    upload({ filename: filename, content: match[2], encoding: 'base64' })
                }
            }
        }
        upload({ filename: 'style.css', content: css })
    }
    // Update the frontmatter in the current note
    let contents = await app.vault.read(file)
    contents = updateFrontmatter(contents, YAML_FIELD + '_updated', moment().format())
    contents = updateFrontmatter(contents, YAML_FIELD + '_link', `${UPLOAD_LOCATION}${shareFile}`)
    app.vault.modify(file, contents)
    new Notice('File has been shared', 5000)
} catch (e) {
    console.log(e)
    new Notice('Failed to share file', 5000)
}
