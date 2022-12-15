const LOCAL_PATH = 'C:\\Users\\your-user-name\\'
const YAML_FIELD = 'share'
const WIDTH = 700
const SHOW_FOOTER = true

/*
 * Obsidian Share
 *
 * Created by Alan Grainger
 * https://github.com/alangrainger/obsidian-share/
 *
 * v1.2.0
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
const status = new Notice('Sharing note...', 60000)

const getHash = async (path) => { return (await path).slice(0, 32) }

function updateFrontmatter(contents, field, value) {
    const f = contents.match(/^---\r?\n(.*?)\n---\r?\n(.*)$/s),
        v = `${field}: ${value}`,
        x = new RegExp(`^${field}:.*$`, 'm'),
        [s, e] = f ? [`${f[1]}\n`, f[2]] : ['', contents]
    return f && f[1].match(x) ? contents.replace(x, v) : `---\n${s}${v}\n---\n${e}`
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
const footer = '<div class="status-bar"><div class="status-bar-item"><span class="status-bar-item-segment">Published with <a href="https://obsidianshare.com/" target="_blank">Obsidian Share</a></span></div></div>'
let html = `
<!DOCTYPE HTML>
<html>
<head>
    <title>${file.basename}</title>
    <meta property="og:title" content="${file.basename}" />
    <meta id="head-description" name="description" content="">
    <meta id="head-og-description" property="og:description" content="">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="style.css">
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
</div></div></div></div></div></div></div></div></div>${SHOW_FOOTER ? footer : ''}</div></body></html>`

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
            const url = localFile + '.' + localFile.split('.').pop()
            el.setAttribute('src', url)
            el.removeAttribute('alt')
            await fs.writeFileSync(LOCAL_PATH + url, fs.readFileSync(localFile, { encoding: 'base64' }), {encoding: 'base64' })
        } catch (e) {
            console.log(e)
        }
    }
    // Share the file
    const shareName = meta?.frontmatter?.[YAML_FIELD + '_hash'] || await getHash(file.path)
    const shareFile = shareName + '.html'
    await fs.writeFileSync(LOCAL_PATH + shareFile, dom.documentElement.innerHTML )
    // Upload theme CSS, unless this file has previously been shared
    // To force a CSS re-upload, just remove the `share_link` frontmatter field
    if (!meta?.frontmatter?.[YAML_FIELD + '_link']) {
        await fs.writeFileSync(LOCAL_PATH + 'style.css', css )
        // Extract any base64 encoded attachments from the CSS.
        // Will use the mime-type list above to determine which attachments to extract.
        const regex = /url\s*\(\W*data:([^;,]+)[^)]*?base64\s*,\s*([A-Za-z0-9/=+]+).?\)/
        for (const attachment of css.match(new RegExp(regex, 'g')) || []) {
            if (match = attachment.match(new RegExp(regex))) {
                if (extension(match[1])) {
                    const filename = (await getHash(match[2])) + `.${extension(match[1])}`
                    css = css.replace(match[0], `url("${filename}")`)
                    await fs.writeFileSync(LOCAL_PATH + 'assets\\' + filename, match[2], {encoding: 'base64' })
                }
            }
        }
    }
    // Update the frontmatter in the current note
    let contents = await app.vault.read(file)
    contents = updateFrontmatter(contents, YAML_FIELD + '_updated', moment().format())
    contents = updateFrontmatter(contents, YAML_FIELD + '_link', `${LOCAL_PATH}${shareFile}`)
    app.vault.modify(file, contents)
    status.hide()
    new Notice('File has been shared', 4000)
} catch (e) {
    console.log(e)
    status.hide()
    new Notice('Failed to share file', 4000)
}
%>