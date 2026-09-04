import { App, moment, requestUrl, TFile } from 'obsidian'
import StatusMessage, { StatusType } from '../StatusMessage'
import API from '../api'
import { buildFieldKey, YamlField } from '../domain/field-keys'
import { parseExistingShareUrl } from '../domain/share-link'
import { parseExpiration } from '../domain/expiration'
import { SettingsStore } from '../shared/settings-store'
import { logger } from '../shared/logger'
import { sha1 } from '../crypto'
import { captureRenderedNote } from './capture'
import { uploadMedia } from './upload-media'
import { uploadCss } from './upload-css'
import { buildPayload } from './build-payload'
import { buildSource } from './build-source'
import { stripEmbeddedFrontmatter, stripFrontmatter } from './transforms/strip-frontmatter'
import { preserveFrontmatterValues } from './transforms/preserve-frontmatter-values'
import { stripBacklinks } from './transforms/strip-backlinks'
import { linkBacklinksToShares } from './transforms/link-backlinks-to-shares'
import { fixCalloutIcons } from './transforms/fix-callout-icons'
import { rewriteLinks } from './transforms/rewrite-links'
import { removeExternalTargets } from './transforms/remove-external-targets'
import { rewriteYoutubeEmbeds } from './transforms/rewrite-youtube-embeds'
import { removeCustomSelectors } from './transforms/remove-custom-selectors'

export interface ShareServiceDeps {
  app: App
  settings: SettingsStore
  api: API
  saveSettings: () => Promise<void>
  authRedirect: (value: string | null) => Promise<void>
}

export interface ShareOptions {
  // Encrypt the note body. Resolved per-invocation by the caller from
  // settings + frontmatter via resolveEncryption().
  encrypted: boolean
  // Embed the note's Markdown source in the page so recipients can import
  // it. Resolved by the caller from settings + frontmatter via
  // resolveIncludeSource().
  includeSource: boolean
  // Re-upload all related assets (CSS bundle + attachments) even if the
  // server already has them.
  forceUpload?: boolean
  // Copy the resulting share URL to the clipboard regardless of the user's
  // `clipboard` setting.
  forceClipboard?: boolean
}

// Heuristic delays carried over from the original Note.share(). Restoring the
// pre-share view state needs to come after the preview-mode switch has
// settled, even though we awaited it inside capture.
const VIEW_RESTORE_DELAY_MS = 200
// Maximum lifetime of the "please don't switch notes" status; the share()
// pipeline normally finishes well inside this.
const INITIAL_STATUS_TIMEOUT_MS = 60 * 1000
// Above this much embedded source the page gets noticeably heavier for every
// reader, so warn the author. Never blocks the share.
const SOURCE_SIZE_WARN_BYTES = 500 * 1024

/**
 * Orchestrates a single share-note operation: capture the rendered DOM,
 * apply the DOM transforms, upload media and CSS, assemble the payload,
 * publish it via the API, and write the resulting URL back to the file's
 * frontmatter.
 *
 * Stateless across calls: each `share(file, options)` runs to completion
 * independently. The original `Note` class was constructed-then-mutated
 * (`forceUpload()`, `forceClipboard()`, `shareAsPlainText()` setters); those
 * decisions are now immutable options on the call.
 */
export class ShareService {
  constructor (private readonly deps: ShareServiceDeps) {}

  private get settings () {
    return this.deps.settings.data
  }

  private field (key: YamlField): string {
    return buildFieldKey(this.settings.yamlField, key)
  }

  async share (file: TFile, options: ShareOptions): Promise<void> {
    const status = new StatusMessage(
      'Please do not change to another note as the current note data is still being parsed.',
      StatusType.Default,
      INITIAL_STATUS_TIMEOUT_MS
    )

    try {
      if (!this.settings.apiKey) {
        void this.deps.authRedirect('share')
        return
      }

      // getActiveFileView is undocumented but reliably returns a leaf that
      // exposes previewMode - getLeaf() omits that on pinned notes.
      // @ts-expect-error - getActiveFileView is undocumented
      const leaf = this.deps.app.workspace.getActiveFileView()?.leaf
      const startMode = leaf.getViewState()

      let captured
      try {
        captured = await captureRenderedNote(leaf)
      } catch (e) {
        logger.error('Failed to parse current note:', e)
        new StatusMessage('Failed to parse the current note', StatusType.Error)
        return
      }

      // Reset the view to the original mode. The timeout is required even
      // though we awaited the preview-mode switch inside captureRenderedNote.
      window.setTimeout(() => {
        void leaf.setViewState(startMode)
      }, VIEW_RESTORE_DELAY_MS)

      status.setStatus('Processing note...')
      const meta = this.deps.app.metadataCache.getFileCache(file)

      // DOM transforms - each is a pure (doc, ctx) -> void function with
      // tests colocated in src/pipeline/transforms/.
      const linkCtx = {
        resolveSharedLink: (text: string) => this.resolveSharedLink(text)
      }

      stripEmbeddedFrontmatter(captured.contentDom)
      if (this.settings.removeYaml) {
        stripFrontmatter(captured.contentDom)
      } else {
        preserveFrontmatterValues(captured.contentDom, meta?.frontmatter)
      }
      if (this.settings.removeBacklinksFooter) {
        stripBacklinks(captured.contentDom)
      } else {
        linkBacklinksToShares(captured.contentDom, linkCtx)
      }
      fixCalloutIcons(captured.contentDom, captured.cssRules)
      rewriteLinks(captured.contentDom, linkCtx)
      removeExternalTargets(captured.contentDom)
      rewriteYoutubeEmbeds(captured.contentDom)
      removeCustomSelectors(captured.contentDom, this.settings.removeElements)

      const expiration = this.resolveExpiration(meta?.frontmatter)

      const uploadResult = await uploadMedia(
        captured.contentDom,
        {
          api: this.deps.api,
          getExcalidrawSvg: async (filesource) => {
            // @ts-ignore - app.plugins is undocumented
            const excalidraw = this.deps.app.plugins.getPlugin('obsidian-excalidraw-plugin')
            if (!excalidraw) return null
            const svg = await excalidraw.ea.createSVG(filesource)
            return svg.outerHTML
          }
        },
        status,
        { expiration }
      )

      await uploadCss(
        captured.css,
        uploadResult.css,
        {
          api: this.deps.api,
          recordUploadedTheme: async () => {
            // @ts-ignore - app.customCss is undocumented
            this.settings.theme = this.deps.app?.customCss?.theme || ''
            await this.deps.saveSettings()
          }
        },
        status,
        { isForceUpload: options.forceUpload, expiration }
      )

      let markdown: string | undefined
      if (options.includeSource) {
        status.setStatus('Embedding source...')
        markdown = await this.buildSourceForFile(file, uploadResult.mediaUrls)
        if (markdown.length > SOURCE_SIZE_WARN_BYTES) {
          new StatusMessage(
            `This note's Markdown source is over ${Math.round(SOURCE_SIZE_WARN_BYTES / 1024)} KB, so the shared page will be slow to load.`,
            StatusType.Info,
            8000
          )
        }
      }

      const existingLink = meta?.frontmatter?.[this.field(YamlField.link)]
      const previousShare = typeof existingLink === 'string'
        ? parseExistingShareUrl(existingLink) ?? undefined
        : undefined

      const { payload, decryptionKey } = await buildPayload({
        contentDom: captured.contentDom,
        elements: captured.elements,
        frontmatter: meta?.frontmatter,
        fallbackTitle: file.basename,
        previousShare,
        titleFrontmatterKey: this.field(YamlField.title),
        isEncrypted: options.encrypted,
        markdown,
        titleSource: this.settings.titleSource,
        noteWidth: this.settings.noteWidth,
        themeMode: this.settings.themeMode
      }, status)

      status.setStatus('Uploading note...')
      let shareLink = await this.deps.api.createNote(payload, expiration)
      // Fetch the uploaded file to pull it through the CDN cache.
      void requestUrl({ url: shareLink, throw: false })

      if (shareLink && options.encrypted) {
        shareLink += '#' + decryptionKey
      }

      let shareMessage = 'The note has been shared'
      if (shareLink) {
        await this.deps.app.fileManager.processFrontMatter(file, (frontmatter) => {
          frontmatter[this.field(YamlField.link)] = shareLink
          frontmatter[this.field(YamlField.updated)] = moment().format()
        })
        if (this.settings.clipboard || options.forceClipboard) {
          try {
            await navigator.clipboard.writeText(shareLink)
            shareMessage = `${shareMessage} and the link is copied to your clipboard 📋`
          } catch {
            // Clipboard write fails if the Obsidian window isn't focused; ignore.
          }
        }
      }

      const successMsg = new StatusMessage(shareMessage, StatusType.Success, 6000)
      if (shareLink) {
        successMsg.addLink(shareLink, '↗️ Open shared note')
      }
    } finally {
      status.hide()
    }
  }

  // Read the note's raw Markdown and prepare it for embedding. Embeds are
  // matched to their hosted URLs by hashing the vault file the same way
  // uploadMedia hashed the rendered asset (sha1 of the original bytes).
  private buildSourceForFile (file: TFile, mediaUrls: Map<string, string>): Promise<string> {
    return this.deps.app.vault.cachedRead(file).then(markdown => buildSource(markdown, {
      fieldPrefix: this.settings.yamlField,
      resolveSharedLink: (text) => this.resolveSharedLink(text),
      resolveEmbed: async (target) => {
        const linked = this.resolveLinkedFile(target, file.path)
        // Note embeds are left as written; only uploaded assets resolve.
        if (!linked || linked.extension === 'md') return undefined
        try {
          const hash = await sha1(await this.deps.app.vault.readBinary(linked))
          return mediaUrls.get(hash)
        } catch (e) {
          logger.warn('Unable to hash embed for source rewrite:', target, e)
          return undefined
        }
      }
    }))
  }

  // Resolve an internal link target to its public shared URL, if any. Used by
  // the link-rewriting transforms via the linkCtx callback.
  private resolveSharedLink (linkText: string): string | undefined {
    const linkedFile = this.resolveLinkedFile(linkText, '')
    if (!linkedFile) return undefined
    const linkedMeta = this.deps.app.metadataCache.getFileCache(linkedFile)
    const href = linkedMeta?.frontmatter?.[this.field(YamlField.link)]
    return typeof href === 'string' ? href : undefined
  }

  // Best-effort lookup of a link target in the metadata cache; undefined on
  // any failure.
  private resolveLinkedFile (linkText: string, sourcePath: string): TFile | undefined {
    try {
      const linked = this.deps.app.metadataCache.getFirstLinkpathDest(linkText, sourcePath)
      return linked instanceof TFile ? linked : undefined
    } catch {
      return undefined
    }
  }

  // Per-note frontmatter (`<prefix>_expires`) takes precedence over the
  // plugin-wide expiry default.
  private resolveExpiration (frontmatter: Record<string, unknown> | undefined): number | undefined {
    const perNote = frontmatter?.[this.field(YamlField.expires)]
    const input = (typeof perNote === 'string' ? perNote : '') || this.settings.expiry
    return parseExpiration(input)
  }
}
