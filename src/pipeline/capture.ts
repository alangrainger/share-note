import { View, WorkspaceLeaf } from 'obsidian'
import { ElementStyle, getElementStyle } from '../NotePayload'
import { sleep } from '../shared/sleep'

export interface PreviewSection {
  el: HTMLElement
}

export interface Renderer {
  parsing: boolean
  pusherEl: HTMLElement
  previewEl: HTMLElement
  sections: PreviewSection[]
}

export interface ViewModes extends View {
  modes: {
    preview: {
      renderer: Renderer
    }
  }
}

export interface CaptureResult {
  contentDom: Document
  cssRules: CSSRule[]
  css: string
  elements: ElementStyle[]
}

export interface CaptureOptions {
  // Wait time after switching the leaf to preview mode. Empirically tuned;
  // see https://github.com/alangrainger/share-note/discussions/162#discussioncomment-15394971
  previewWaitMs?: number
  // Wait time after scrolling to the top of the preview.
  scrollWaitMs?: number
}

const DEFAULT_PREVIEW_WAIT_MS = 600
const DEFAULT_SCROLL_WAIT_MS = 100

/**
 * Snapshot the active leaf's rendered view: DOM, CSS rules, and the element
 * styles the published page needs to mimic the local theme. Mutates the leaf's
 * view state to switch to preview mode; the caller is responsible for
 * restoring the original view state afterwards.
 */
export async function captureRenderedNote (
  leaf: WorkspaceLeaf,
  options: CaptureOptions = {}
): Promise<CaptureResult> {
  const previewWaitMs = options.previewWaitMs ?? DEFAULT_PREVIEW_WAIT_MS
  const scrollWaitMs = options.scrollWaitMs ?? DEFAULT_SCROLL_WAIT_MS

  // Switch to reading mode
  const previewMode = leaf.getViewState()
  if (previewMode.state) previewMode.state.mode = 'preview'
  await leaf.setViewState(previewMode)
  await sleep(previewWaitMs)

  // Scroll the view to the top to ensure we get the default margins for
  // .markdown-preview-pusher.
  // @ts-ignore - leaf.view.previewMode is undocumented
  leaf.view.previewMode.applyScroll(0)
  await sleep(scrollWaitMs)

  const view = leaf.view as ViewModes
  const renderer = view.modes.preview.renderer

  // Copy classes and styles
  const elements: ElementStyle[] = []
  elements.push(getElementStyle('html', activeDocument.documentElement))
  const bodyStyle = getElementStyle('body', activeDocument.body)
  bodyStyle.classes.push('share-note-plugin') // Targetable class for published notes
  elements.push(bodyStyle)
  elements.push(getElementStyle('preview', renderer.previewEl))
  elements.push(getElementStyle('pusher', renderer.pusherEl))

  const html = await sampleRenderedHtml(view)
  const contentDom = new DOMParser().parseFromString(html, 'text/html')

  // MathJax CHTML builds its per-glyph stylesheet (<style id="MJX-CHTML-styles">)
  // incrementally as equations render, and the CSSOM `.cssRules` view of that
  // element can be stale/incomplete at capture time - which silently drops glyphs
  // (especially Greek) from shared equations. When this note contains rendered
  // math, read the element's textContent directly (the source of truth) instead
  // of trusting `.cssRules`. https://github.com/alangrainger/share-note/issues/34
  const mjxStyleEl = contentDom.querySelector('mjx-container')
    ? activeDocument.getElementById('MJX-CHTML-styles')
    : null
  const mjxText = mjxStyleEl?.textContent?.trim()

  const cssRules: CSSRule[] = []
  for (const sheet of Array.from(activeDocument.styleSheets)) {
    // Skip the MathJax sheet when we have its textContent - the complete version
    // is appended below. If textContent is empty, MathJax populated the CSSOM
    // directly and `.cssRules` is authoritative, so fall through and keep it.
    if (mjxText && sheet.ownerNode === mjxStyleEl) continue
    for (const rule of Array.from(sheet.cssRules)) cssRules.push(rule)
  }

  // Merge CSS rules into a single string for later minifying. @media print
  // rules are dropped because they prevent the print preview from showing on
  // the web - https://github.com/alangrainger/share-note/issues/75#issuecomment-2708719828
  let css = cssRules
    .filter(rule => (rule as CSSMediaRule).media?.[0] !== 'print')
    .map(rule => rule.cssText).join('').replace(/\n/g, '')
  if (mjxText) css += mjxText.replace(/\n/g, '')

  return { contentDom, cssRules, css, elements }
}

// Renderer-sampling heuristic. Obsidian's preview renderer streams sections
// in asynchronously; we poll until either (a) the document is short enough
// that the whole thing is rendered, or (b) the tail of the section list is
// substantively rendered. Constants are tuned empirically to give recent
// sections time to populate without waiting on a fully-rendered long note.
const RENDER_POLL_MAX_TICKS = 40
const RENDER_POLL_INTERVAL_MS = 100
// A note this short fits in one renderer pass; no need to keep waiting.
const SHORT_NOTE_SECTION_COUNT = 12
// Sample size taken from the trailing-but-not-last sections of a long note.
const RENDER_TAIL_WINDOW = 7
// How many of the tail sections need innerHTML before we consider the
// renderer "caught up enough" to read.
const RENDER_TAIL_RENDERED_THRESHOLD = 3

async function sampleRenderedHtml (view: ViewModes): Promise<string> {
  const renderer = view.modes.preview.renderer
  let parsing = 0
  for (let count = 0; count < RENDER_POLL_MAX_TICKS; count++) {
    try {
      if (renderer.parsing) parsing++
      if (count > parsing) {
        const sections = renderer.sections
        if (sections.length <= SHORT_NOTE_SECTION_COUNT) break
        const tail = sections.slice(sections.length - RENDER_TAIL_WINDOW, sections.length - 1)
        const rendered = tail.filter(s => s.el.innerHTML).length
        if (rendered > RENDER_TAIL_RENDERED_THRESHOLD) break
      }
    } catch {
      break
    }
    await sleep(RENDER_POLL_INTERVAL_MS)
  }
  return renderer.sections.reduce((p, c) => p + c.el.outerHTML, '')
}
