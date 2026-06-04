import { sha1 } from '../crypto'
import API, { CheckFilesResult } from '../api'
import StatusMessage from '../StatusMessage'
import { logger } from '../shared/logger'

export interface UploadMediaDeps {
  api: API
  // Returns the SVG outerHTML for the given Excalidraw filesource attribute,
  // or null if Excalidraw isn't installed. Throws if SVG creation fails;
  // uploadMedia will log and skip just that element.
  getExcalidrawSvg: (filesource: string) => Promise<string | null>
}

export interface UploadMediaOptions {
  expiration?: number
}

/**
 * Walk the rendered DOM's `<img>`/`<video>` elements, queue each local asset
 * for upload, and resolve to the server's check-files result.
 *
 * Mutates `contentDom` in two ways:
 * - removes the `alt` attribute from every processed element;
 * - sets `src` to the uploaded URL once each individual upload completes
 *   (the mutation happens lazily inside the queueUpload callback).
 *
 * Web assets (anything fetched over http(s) except localhost) are skipped:
 * they stay in place and keep their original src + alt.
 */
export async function uploadMedia (
  contentDom: Document,
  deps: UploadMediaDeps,
  status: StatusMessage,
  options: UploadMediaOptions = {}
): Promise<CheckFilesResult> {
  status.setStatus('Processing attachments...')

  for (const el of contentDom.querySelectorAll('img,video')) {
    const src = el.getAttribute('src')
    if (!src) continue

    if (src.startsWith('http') && !src.match(/^https?:\/\/localhost/)) {
      // This is a web asset, no need to upload.
      continue
    }

    const filesource = el.getAttribute('filesource')
    let content: ArrayBuffer | string | undefined
    let filetype: string | undefined

    if (filesource?.match(/excalidraw/i)) {
      try {
        const svg = await deps.getExcalidrawSvg(filesource)
        if (svg === null) continue // Excalidraw plugin not installed; leave element as-is
        content = svg
        filetype = 'svg'
      } catch (e) {
        logger.error('Unable to process Excalidraw drawing:', e)
      }
    } else {
      try {
        // NOTE: we use fetch (not requestUrl) here because src is typically an
        // `app://` URL pointing at a local vault file - requestUrl is for HTTP
        // and doesn't handle Obsidian's custom protocols.
        // eslint-disable-next-line no-restricted-globals
        const res = await fetch(src)
        if (res && res.status === 200) {
          content = await res.arrayBuffer()
          const parsed = new URL(src)
          filetype = parsed.pathname.split('.').pop()
        }
      } catch (_e) {
        // Unable to process this file
        continue
      }
    }

    if (filetype && content) {
      const hash = await sha1(content)
      await deps.api.queueUpload({
        data: {
          filetype,
          hash,
          content,
          // String content (Excalidraw SVG) historically omitted byteLength;
          // ArrayBuffer content sets it.
          byteLength: typeof content === 'string' ? undefined : content.byteLength,
          expiration: options.expiration
        },
        callback: (url) => el.setAttribute('src', url)
      })
    }
    el.removeAttribute('alt')
  }

  return deps.api.processQueue(status)
}
