import { minify } from 'csso'
import { dataUriToBuffer } from 'data-uri-to-buffer'
import { sha1 } from '../crypto'
import API, { CheckFilesResult } from '../api'
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
}

/**
 * Process and (conditionally) upload the rendered note's CSS:
 *
 * - Extract `url(...)` references from the CSS string, queue each local /
 *   data: asset for upload, and rewrite the url() refs to the uploaded URLs.
 * - Minify the (now-rewritten) CSS and upload it if its hash differs from
 *   the server's existing copy.
 * - On success, invoke `deps.recordUploadedTheme()` so the caller can
 *   persist whichever theme is now considered current.
 *
 * Skips the whole step when the server already has CSS for this note and
 * the caller hasn't requested a force-reupload.
 *
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
): Promise<void> {
  // The CSS bundle stays on the server until the user explicitly asks to
  // overwrite it, so re-shares are cheap.
  if (!options.isForceUpload && cssResult) return

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
  const cssHash = await sha1(minified)
  try {
    if (cssHash !== cssResult?.hash) {
      await deps.api.upload({
        filetype: 'css',
        hash: cssHash,
        content: minified,
        byteLength: minified.length,
        expiration: options.expiration
      })
    }
    await deps.recordUploadedTheme()
  } catch (e) {
    logger.error('CSS upload failed:', e)
  }
}
