// Add a unique identifier for yourself. At some point in the future I might add user accounts, so it would be a good
// idea to use your email address. **This will not be sent to the server!** Privacy first.
const ACCOUNT_ID = 'A unique ID'
const YAML_FIELD = 'share'
const WIDTH = 700
const SHOW_FOOTER = true

/*
 * Obsidian Share Public
 *
 * Created by Alan Grainger
 * https://github.com/alangrainger/obsidian-share/
 *
 * v1.1.6
 */

const fs = require('fs')
const leaf = app.workspace.activeLeaf
const startMode = leaf.getViewState()
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
const status = new Notice('Sharing note...', 60000)

async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
const getHash = async (path) => { return (await sha256(path)).slice(0, 32) }
const id = await getHash(ACCOUNT_ID)

function updateFrontmatter(contents, field, value) {
    const f = contents.match(/^---\r?\n(.*?)\n---\r?\n(.*)$/s),
      v = `${field}: ${value}`,
      x = new RegExp(`^${field}:.*$`, 'm'),
      [s, e] = f ? [`${f[1]}\n`, f[2]] : ['', contents]
    return f && f[1].match(x) ? contents.replace(x, v) : `---\n${s}${v}\n---\n${e}`
}

async function upload(data) {
    data.id = id
    status.setMessage(`Uploading ${data.filename}...`)
    return requestUrl({
        url: 'https://file.obsidianshare.com/sharefile.php',
        method: 'POST',
        timeout: 1000,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
}

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
const footer = '<div class="status-bar"><div class="status-bar-item"><span class="status-bar-item-segment">Published with <a href="https://obsidianshare.com/" target="_blank">Obsidian Share</a></span></div></div>'
let html = `
<!DOCTYPE HTML>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${file.basename}</title>
    <meta property="og:title" content="${file.basename}" />
    <meta id="head-description" name="description" content="">
    <meta id="head-og-description" property="og:description" content="">
    <link rel="icon" type="image/x-icon" href="favicon.ico">
    <link rel="stylesheet" href="${id}.css">
    <style>
    html, body {
        overflow: visible !important;
    }
    .view-content {
        height: 100% !important;
    }
    </style>
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
</div></div></div></div></div></div></div></div>${SHOW_FOOTER ? footer : ''}</div></div></body></html>`

try {
    // Generate the HTML file for uploading
    const dom = new DOMParser().parseFromString(html, 'text/html')
    // Remove frontmatter to avoid sharing unwanted data
    dom.querySelector('pre.frontmatter')?.remove()
    dom.querySelector('div.frontmatter-container')?.remove()
    // Set the meta description and OG description
    const meta = app.metadataCache.getFileCache(file)
    try {
        const desc = Array.from(dom.querySelectorAll("p")).map(x => x.innerText).filter(x => !!x).join(' ').slice(0, 200) + '...'
        dom.querySelector('#head-description').content = desc
        dom.querySelector('#head-og-description').content = desc
    } catch (e) { }
    // Replace links
    for (const el of dom.querySelectorAll("a.internal-link")) {
        if (href = el.getAttribute('href').match(/^([^#]+)/)) {
            const file = app.metadataCache.getFirstLinkpathDest(href[1], '')
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
            const url = (await getHash(id + localFile)) + '.' + localFile.split('.').pop()
            el.setAttribute('src', url)
            el.removeAttribute('alt')
            await upload({ filename: url, content: fs.readFileSync(localFile, { encoding: 'base64' }), encoding: 'base64' })
        } catch (e) {
            console.log(e)
        }
    }
    // Share the file
    const shareName = meta?.frontmatter?.[YAML_FIELD + '_hash'] || await getHash(id + file.path)
    const shareFile = shareName + '.html'
    await upload({ filename: shareFile, content: dom.documentElement.innerHTML })
    // Upload theme CSS, unless this file has previously been shared
    // To force a CSS re-upload, just remove the `share_link` frontmatter field
    if (!meta?.frontmatter?.[YAML_FIELD + '_link']) {
        await upload({ filename: id + '.css', content: css })
        // Extract any base64 encoded attachments from the CSS.
        // Will use the mime-type list above to determine which attachments to extract.
        const regex = /url\s*\(\W*data:([^;,]+)[^)]*?base64\s*,\s*([A-Za-z0-9/=+]+).?\)/
        for (const attachment of css.match(new RegExp(regex, 'g')) || []) {
            if (match = attachment.match(new RegExp(regex))) {
                if (extension(match[1])) {
                    const filename = (await getHash(match[2])) + `.${extension(match[1])}`
                    css = css.replace(match[0], `url("${filename}")`)
                    await upload({ filename: filename, content: match[2], encoding: 'base64' })
                }
            }
        }
    }
    // Update the frontmatter in the current note
    let contents = await app.vault.read(file)
    contents = updateFrontmatter(contents, YAML_FIELD + '_updated', moment().format())
    contents = updateFrontmatter(contents, YAML_FIELD + '_link', 'https://file.obsidianshare.com/' + shareFile)
    app.vault.modify(file, contents)
    status.hide()
    new Notice('File has been shared', 4000)
} catch (e) {
    console.log(e)
    status.hide()
    new Notice('Failed to share file', 4000)
}
