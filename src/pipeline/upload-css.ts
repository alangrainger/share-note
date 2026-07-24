import { minify } from 'csso'
import { dataUriToBuffer } from 'data-uri-to-buffer'
import { sha1 } from '../crypto'
import API, { CheckFilesResult, CssFileInfo, normalizeCssResult } from '../api'
import { getFromExtension, getFromMimetype, getFromSignature } from '../domain/file-types'
import StatusMessage from '../StatusMessage'
import { logger } from '../shared/logger'

export interface UploadCssDeps {
  api: API
  // Called inside upload-css's try-catch after the main CSS upload step
  // succeeds (or is skipped because the hash matched the server's). Used by
  // the orchestrator to record which Obsidian theme the server now hosts.
  recordUploadedTheme: () => Promise<void>
}

export interface UploadCssOptions {
  // Force a re-upload even when the server already has matching CSS.
  isForceUpload?: boolean
  // Per-note expiration in epoch-ms, propagated to each queued upload.
  expiration?: number
  // Max UTF-8 byte size per CSS chunk. Large themes are split so the
  // published page can load styles progressively.
  maxChunkSize?: number
}

const DEFAULT_CSS_CHUNK_SIZE = 500 * 1024 // 500KB

/**
 * Split CSS into chunks at rule boundaries to avoid breaking syntax.
 * Falls back to a force-split at 1.5x max size when a single rule is huge.
 */
export function splitCssIntoChunks (css: string, maxChunkSize: number = DEFAULT_CSS_CHUNK_SIZE): string[] {
  const encoder = new TextEncoder()
  if (encoder.encode(css).length <= maxChunkSize) {
    return [css]
  }

  const chunks: string[] = []
  let currentChunk = ''
  let currentChunkSize = 0
  let braceDepth = 0
  let inString = false
  let stringChar = ''

  for (let i = 0; i < css.length; i++) {
    const char = css[i]
    const charBytes = encoder.encode(char).length

    if (!inString && (char === '"' || char === "'")) {
      inString = true
      stringChar = char
    } else if (inString && char === stringChar && css[i - 1] !== '\\') {
      inString = false
      stringChar = ''
    }

    if (!inString) {
      if (char === '{') braceDepth++
      else if (char === '}') braceDepth--
    }

    currentChunk += char
    currentChunkSize += charBytes

    if (currentChunkSize >= maxChunkSize) {
      if (braceDepth === 0 && !inString && char === '}') {
        chunks.push(currentChunk)
        currentChunk = ''
        currentChunkSize = 0
      } else if (currentChunkSize >= maxChunkSize * 1.5) {
        // Force split for extremely long rules so we never emit unbounded chunks.
        chunks.push(currentChunk)
        currentChunk = ''
        currentChunkSize = 0
      }
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk)
  }

  return chunks.length > 0 ? chunks : [css]
}

/**
 * Process and (conditionally) upload the rendered note's CSS:
 *
 * - Extract `url(...)` references from the CSS string, queue each local /
 *   data: asset for upload, and rewrite the url() refs to the uploaded URLs.
 * - Minify the (now-rewritten) CSS and upload it (optionally as multiple
 *   chunks) if its hash differs from the server's existing copy.
 * - On success, invoke `deps.recordUploadedTheme()` so the caller can
 *   persist whichever theme is now considered current.
 *
 * Returns the CSS file list that should be attached to the note payload.
 * Failures inside the main CSS upload / theme record are logged but not
 * rethrown - matching the original behaviour, where these are considered
 * non-fatal to the surrounding share() pipeline. Per-asset failures during
 * `processQueue` propagate.
 */
export async function uploadCss (
  css: string,
  cssResult: CheckFilesResult['css'],
  deps: UploadCssDeps,
  status: StatusMessage,
  options: UploadCssOptions = {}
): Promise<CssFileInfo[] | undefined> {
  const existingCss = normalizeCssResult(cssResult)
  const maxChunkSize = options.maxChunkSize ?? DEFAULT_CSS_CHUNK_SIZE

  // The CSS bundle stays on the server until the user explicitly asks to
  // overwrite it, so re-shares are cheap.
  if (!options.isForceUpload && existingCss) {
    return existingCss
  }

  // The url() rewrite callbacks fire when each upload completes; mutate a
  // local rather than the caller's input.
  let workingCss = css

  status.setStatus('Processing CSS...')
  const attachments = workingCss.match(/url\s*\(.*?\)/g) || []
  for (const attachment of attachments) {
    const assetMatch = attachment.match(/url\s*\(\s*"((?:\\.|[^"\\])*)"\s*\)/)
    if (!assetMatch) continue
    const assetUrl = assetMatch?.[1] || ''

    if (assetUrl.startsWith('data:')) {
      const parsed = dataUriToBuffer(assetUrl)
      if (!parsed?.type) continue
      if (parsed.type === 'application/octet-stream') {
        // Recover the mimetype from magic bytes when the data URI doesn't say
        const decoded = getFromSignature(parsed.buffer)
        if (!decoded) continue
        parsed.type = decoded.mimetypes[0]
      }
      const filetype = getFromMimetype(parsed.type)?.extension
      if (!filetype) continue
      const hash = await sha1(parsed.buffer)
      await deps.api.queueUpload({
        data: {
          filetype,
          hash,
          content: parsed.buffer,
          byteLength: parsed.buffer.byteLength,
          expiration: options.expiration
        },
        callback: (url) => {
          workingCss = workingCss.replace(assetMatch[0], `url("${url}")`)
        }
      })
    } else if (assetUrl && !assetUrl.startsWith('http')) {
      const filename = assetUrl.match(/([^/\\]+)\.(\w+)$/)
      if (!filename) continue
      if (!getFromExtension(filename[2])) continue
      // Fetch the attachment content. See note in upload-media.ts - we need
      // fetch here because CSS url() refs are typically local (e.g. theme
      // fonts) and requestUrl doesn't handle app:// URLs.
      // eslint-disable-next-line no-restricted-globals
      const res = await fetch(assetUrl)
      const contents = await res.arrayBuffer()
      const hash = await sha1(contents)
      await deps.api.queueUpload({
        data: {
          filetype: filename[2],
          hash,
          content: contents,
          byteLength: contents.byteLength,
          expiration: options.expiration
        },
        callback: (url) => {
          workingCss = workingCss.replace(assetMatch[0], `url("${url}")`)
        }
      })
    }
  }

  status.setStatus('Uploading CSS attachments...')
  await deps.api.processQueue(status, 'CSS attachment')

  status.setStatus('Uploading CSS...')
  const minified = minify(workingCss).css
  const encoder = new TextEncoder()
  const cssBytes = encoder.encode(minified)
  const cssHash = await sha1(minified)

  let nextCss = existingCss

  try {
    const chunks = splitCssIntoChunks(minified, maxChunkSize)
    const needsSplitting = chunks.length > 1
    const hasExistingChunks = (existingCss?.length || 0) > 1
    const needsResplit = needsSplitting && !hasExistingChunks
    const hashChanged = !existingCss || cssHash !== existingCss[0]?.hash

    if (hashChanged || needsResplit || options.isForceUpload) {
      if (needsSplitting) {
        status.setStatus(`Uploading CSS chunks (${chunks.length} files)...`)
        const cssFiles: CssFileInfo[] = []

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i]
          const chunkBytes = encoder.encode(chunk)
          const chunkContentHash = await sha1(chunk)
          // Unique hash for filename generation (includes chunk index).
          const chunkHashForFilename = await sha1(`${i + 1}-${chunkContentHash}-${chunks.length}`)

          status.setStatus(`Uploading CSS chunk ${i + 1} of ${chunks.length}...`)
          const chunkUrl = await deps.api.upload({
            filetype: 'css',
            hash: chunkHashForFilename,
            content: chunk,
            byteLength: chunkBytes.length,
            expiration: options.expiration
          })

          if (chunkUrl) {
            cssFiles.push({
              url: chunkUrl,
              hash: chunkContentHash
            })
          }
        }

        nextCss = cssFiles.length > 0 ? cssFiles : existingCss
      } else if (hashChanged || options.isForceUpload) {
        const singleCssUrl = await deps.api.upload({
          filetype: 'css',
          hash: cssHash,
          content: minified,
          byteLength: cssBytes.length,
          expiration: options.expiration
        })

        if (singleCssUrl) {
          nextCss = [{
            url: singleCssUrl,
            hash: cssHash
          }]
        }
      }
    }

    await deps.recordUploadedTheme()
  } catch (e) {
    logger.error('CSS upload failed:', e)
  }

  return nextCss
}
