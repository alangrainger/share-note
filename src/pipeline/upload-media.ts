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

const MIME_TO_EXT: Record<string, string> = {
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

/**
 * Valid file extensions are short alphanumeric tokens (e.g. "png").
 * Blob URLs and some plugin-generated paths produce UUIDs / long path
 * segments that must not be treated as extensions.
 */
export function isValidFileExtension (ext: string | undefined): boolean {
  return !!ext && ext.length <= 10 && /^[a-z0-9]+$/i.test(ext)
}

export function detectMediaTypeFromMime (contentType: string | null | undefined): string | undefined {
  if (!contentType) return undefined
  return MIME_TO_EXT[contentType.split(';')[0].trim().toLowerCase()]
}

/**
 * Detect image/video type from magic bytes. Used when the URL has no usable
 * extension (common for blob: URLs produced by plugins like Code Styler).
 */
export function detectMediaTypeFromSignature (content: ArrayBuffer): string | undefined {
  if (content.byteLength < 4) return undefined
  const bytes = new Uint8Array(content, 0, Math.min(content.byteLength, 12))

  // PNG: 89 50 4E 47
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

  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'webp'
  }

  // BMP: 42 4D
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
    return 'bmp'
  }

  // MP4: ftyp box at offset 4
  if (
    bytes.length >= 8 &&
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
  ) {
    return 'mp4'
  }

  // WebM: 1A 45 DF A3
  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
    return 'webm'
  }

  // SVG: text markers near the start
  const sample = new TextDecoder('utf-8', { fatal: false })
    .decode(new Uint8Array(content, 0, Math.min(content.byteLength, 256)))
    .trimStart()
  if (sample.startsWith('<?xml') || sample.startsWith('<svg')) {
    return 'svg'
  }

  return undefined
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
 *
 * Blob URLs without a recognizable media payload (e.g. Code Styler icons)
 * are skipped to avoid 415 Unsupported Media Type upload errors.
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
    const isBlobUrl = src.startsWith('blob:')
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

          // Prefer the URL extension when it looks like a real media extension.
          try {
            const parsed = new URL(src)
            const fromUrl = parsed.pathname.split('.').pop()
            if (isValidFileExtension(fromUrl)) {
              filetype = fromUrl
            }
          } catch {
            // blob: / malformed URLs may not parse cleanly on all platforms
          }

          // Fall back to Content-Type, then magic-byte detection. This is
          // essential for blob: URLs whose path is a UUID, not a filename.
          if (!filetype) {
            filetype = detectMediaTypeFromMime(res.headers.get('content-type'))
          }
          if (!filetype && content) {
            filetype = detectMediaTypeFromSignature(content)
          }
        }
      } catch {
        // Unable to process this file
        continue
      }
    }

    // Blob URLs that aren't real media (plugin-generated icon blobs, etc.)
    // must not be uploaded - the server rejects them with HTTP 415.
    if (isBlobUrl && !filetype) {
      continue
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
