# Contributing to Share Note

This file is the orientation guide for anyone — human contributor or AI assistant — picking up this codebase. It covers what the project is, how the pipeline actually works end-to-end, the server contract on the other side, and the conventions and gotchas that aren't obvious from reading the code in isolation.

For user-facing docs (installing, sharing a note, encryption explanation), see the [README](README.md) and <https://docs.note.sx/>.

---

## What this is

Share Note is an Obsidian community plugin that publishes a Markdown note as a standalone webpage that looks **identical** to how it renders in the user's vault — same theme, same CSS snippets, same plugin output (Dataview, callouts, MathJax, Excalidraw, etc.). Notes are end-to-end encrypted by default: the decryption key lives only in the URL fragment, never on the server.

The plugin is the client. The server (`https://api.note.sx` by default, self-hostable) is a separate codebase: <https://github.com/note-sx/server>. The server is **feature-complete** — only dependency bumps are expected there. Treat the endpoint contract documented below as a fixed surface: design plugin changes to fit it, rather than proposing new server endpoints.

---

## How it works, end-to-end

When the user runs the **Share current note** command on an active Markdown file:

1. **Force reading mode.** The plugin switches the leaf to preview mode and waits ~600 ms for the renderer to settle. It then scrolls to the top so `.markdown-preview-pusher` reports its default top margin (themes with banners read this).

2. **Wait for the renderer to actually finish.** Obsidian's reading-mode renderer is lazy — long notes are virtualised. `sampleRenderedHtml` inside `src/pipeline/capture.ts` polls `renderer.sections` for up to ~4 s, waiting until enough sections at the tail have populated, before scraping the HTML. Don't shorten this without testing on a long note.

3. **Capture the DOM.** All sections' `outerHTML` is concatenated and parsed into a detached `Document`. Inline `style` and `class` lists for `html`, `body`, `.markdown-preview-view`, `.markdown-preview-pusher` are captured separately so the published page can reproduce them.

4. **Capture all stylesheets.** Every rule from every entry in `document.styleSheets` is merged into one big string. `@media print` rules are dropped (they break print preview on the web; see issue #75).

5. **Rewrite the DOM:**
   - Frontmatter block is removed (or hydrated with values from `metadataCache` if the user keeps it).
   - Optional: backlinks footer removed, plus any user-specified CSS selectors from settings.
   - **Callout icons** prefer the rendered SVG's `lucide-<name>` class when present, falling back to the captured stylesheet's `--callout-icon` CSS variable. The SVG class is authoritative because Obsidian sometimes sets `--callout-icon` to an internal glyph name (e.g. `quote-glyph`) that Lucide can't resolve. Callouts below the fold may not have their SVG rendered yet - those still rely on the CSS variable, and will show a missing icon when the CSS value isn't a Lucide name.
   - **Internal links** (`a.internal-link`, `a.footnote-link`): if the linked note has a `share_link` in its frontmatter, the link is rewritten to point at that public URL. Otherwise the link is replaced with its plain text (we don't want broken links on the published page).
   - **Heading anchor links** (`href="#…"`) get rewritten to `onclick="…scrollIntoView()"`. We can't use `#fragment` because the URL fragment already carries the decryption key.
   - `target="_blank"` is stripped from external links.

6. **Process attachments.** Images, videos, and Excalidraw embeds are pulled from the DOM. Each is fetched (via `fetch()` against `app://` — see Conventions), hashed (SHA-1), optionally compressed (see `Compressor.ts` — jpg/jpeg/png/webp/bmp only, and only above 100KB; bmp is force-converted to JPG), and added to the upload queue. Excalidraw drawings are rendered to SVG via the Excalidraw plugin's API.

7. **Process CSS attachments.** Every `url(…)` reference in the merged stylesheet is resolved: `data:` URIs are decoded, local `app://` URLs are fetched. Only whitelisted MIME types are extracted (`ttf`, `otf`, `woff`, `woff2`, `svg`). Each attachment is queued like a media upload, and its `url(…)` in the CSS is rewritten to the server URL once uploaded.

8. **Deduplicate against the server.** Before uploading anything, the queue is sent to `POST /v1/file/check-files` with `{hash, filetype, byteLength}` for each item. The server returns which hashes it already has (`{url}`) and which it needs. Only missing items are POSTed to `/v1/file/upload`. This is what makes re-shares cheap — most assets never re-upload.

9. **CSS is uploaded only on first share or `Force re-upload`.** The user's chosen theme stays frozen on the server until they explicitly ask to refresh it (Force re-upload of all data for this note). This means changing the local theme doesn't break already-published notes.

10. **Encrypt the note body.** The content HTML + title is `JSON.stringify`'d, then AES-GCM-256 encrypted in 2000-char chunks (see Crypto below). The key is fresh-random for new notes; for re-shares, the existing key in the current `share_link` fragment is reused so the URL stays stable.

11. **Upload the note.** `POST /v1/file/create-note` with the payload (HTML body or ciphertext, theme element styles, title, description, expiry, etc.). The server returns the public URL.

12. **Wire the result back into the vault.** The decryption key is appended to the returned URL as a `#fragment`, and the user's note frontmatter gets `share_link` and `share_updated` written. The plugin then `requestUrl()`s the share URL once to warm the CDN cache. The full link is copied to the clipboard if enabled.

---

## Server contract

The plugin talks to a small JSON HTTP API. Full server lives at <https://github.com/note-sx/server>. The endpoints and conventions used by the plugin are:

### Auth

There's no password and no email. The user proves they're a human via Cloudflare Turnstile and the server returns an API key:

- Plugin opens `GET {server}/v1/account/get-key?id={uid}` in the browser.
- After Turnstile, the server redirects to `obsidian://share-note?action=share-note&key={apiKey}`.
- The plugin's protocol handler stores `apiKey` in settings.
- `settings.authRedirect` remembers what the user was trying to do (e.g. `'share'`) so the action resumes automatically after auth.

`uid` is a SHA-256-derived 32-char hex string generated locally on first plugin load. It's how the server identifies an account; the API key authorises actions.

### Request signing

Every API request carries:

| Header | Value |
|---|---|
| `x-sharenote-id` | `settings.uid` |
| `x-sharenote-nonce` | `Date.now().toString()` |
| `x-sharenote-key` | `sha256(nonce + apiKey)` |
| `x-sharenote-version` | Plugin version (from `manifest.json`) |

The raw API key is **never** sent over the wire — only `sha256(nonce + key)`. The nonce makes each request signature unique so the digest can't be replayed.

### Endpoints used

| Endpoint | Purpose |
|---|---|
| `POST /v1/file/check-files` | Bulk hash check. Body: `{files: [{hash, filetype, byteLength}, ...]}`. Returns `{files: [...with optional .url], css?: {url, hash}}`. Only items without a returned `url` need to be uploaded. |
| `POST /v1/file/upload` | Raw asset upload. Body is the file bytes (or string for SVG). Headers carry `x-sharenote-filetype`, `x-sharenote-hash`, `x-sharenote-bytelength`. Returns `{url}`. Retried up to 4× on 5xx. |
| `POST /v1/file/create-note` | Create/update a shared note. Body: `{filename?, filetype: 'html', hash, expiration?, template: NotePayload}`. The wire key is historically `template`; the TS type is `NotePayload`. Returns `{url}`. Retried up to 3× on 5xx. |
| `POST /v1/file/delete` | Delete a shared note. Body: `{filename, filetype: 'html'}`. |
| `GET /v1/account/get-key?id={uid}` | Browser-facing auth flow (Turnstile → `obsidian://` redirect). |

### Error handling

`api.ts` retries 5xx responses and surfaces 4xx errors via `StatusMessage`. Errors thrown out of the API layer are instances of `ShareError` (or its subclasses `NetworkError`, `AuthError`, `UploadError`) defined in `src/shared/errors.ts`. When a user-facing message has already been shown at the throw site, the error carries `handled: true` so the top-level catch in `main.ts` can skip the generic fallback. **Don't reinvent this with sentinel strings** — add a `ShareError` subclass if you need richer error types.

The server can also return status `462` ("invalid API key"), which the plugin treats as a cue to restart the auth flow. The `onUnauthenticated` callback (injected when `API` is constructed) fires, and the API layer throws `AuthError`.

---

## Conventions and gotchas

### Linting & style

- **`neostandard` with `semi: false`, single quotes, 2-space indent.** Run `npm run lint`. CI/build calls this before `tsc`.
- **`eslint-plugin-obsidianmd`** is also in the chain — it enforces Obsidian's plugin guidelines (e.g. `detachLeaves`, `noGlobalThis`, `noNodejsModules`, `noTFileTFolderCast`, `noStaticStylesAssignment`, `hardcodedConfigPath`). Don't disable rules wholesale; if you genuinely need an exception, scope an inline `// eslint-disable-next-line` comment with a one-line *why*.
- `tsconfig.json` runs `strict: true` with `target: ES2022`. A handful of `no-unsafe-*` rules and `@typescript-eslint/no-non-null-assertion` are still disabled in `eslint.config.mjs` — re-enabling them is on the open backlog but not a precondition for new work.
- **Tests run as part of the build.** `npm run build` is `lint → tsc → vitest → esbuild`. Tests are colocated next to source (`crypto.test.ts` next to `crypto.ts`); happy-dom provides DOM/window in tests, and `src/__mocks__/obsidian.ts` is the runtime stub for the `obsidian` module (aliased in `vitest.config.ts`). Add stubs there only as tests need them — anything not stubbed surfaces as a clear undefined error.

### `requestUrl()` vs `fetch()`

Obsidian's `requestUrl()` is the cross-platform HTTP client and **must** be used for every call to the Share Note server. It avoids CORS, works on mobile, and is what Obsidian's plugin reviewers expect.

`fetch()` is used in exactly two places, both reading local vault assets through Obsidian's `app://` protocol: `src/pipeline/upload-media.ts` (image and video attachments) and `src/pipeline/upload-css.ts` (theme fonts referenced from CSS `url(...)`). `requestUrl()` does not handle `app://`, so native `fetch()` is required. These spots carry an inline `eslint-disable no-restricted-globals` comment explaining why. **Don't introduce more `fetch()` calls.**

This split is also documented in the README's "Disclosures" section because Obsidian's plugin scorecard flags it.

### Encryption

Implemented in `src/crypto.ts`:

- **AES-GCM-256.** Key is a 256-bit value derived from `crypto.getRandomValues(64-byte seed)` via PBKDF2 (`SHA-256`, 100k iters, zero salt — the seed is already 64 bytes of entropy).
- **Chunked at 2000 plaintext chars. Each chunk uses a fresh random 12-byte IV** generated via `crypto.getRandomValues(new Uint8Array(12))`. The IVs are base64-encoded into the `payload.ivs` array, parallel to `payload.ciphertext`. The wire-format change is also reflected server-side: plugins >= 1.5.0 are served a `decrypt.js` that reads `ivs[index]`; older plugins still get the legacy deterministic template. **Do not reintroduce deterministic IVs.** The roundtrip + IV-uniqueness regression tests in `crypto.test.ts` guard against this.
- **Key encoding.** The base64-encoded 256-bit key is sliced to 43 characters (the unpadded base64 length) and appended to the share URL after `#`. The server never sees the fragment.
- **Re-shares reuse the existing key**, parsed out of the existing `share_link` frontmatter, so URLs stay stable across updates. With random per-chunk IVs, re-using the key across re-shares is safe.

`sha1` is used for content-dedup hashing only — it is not used for any security-bearing decision. `sha256` is used for the request-signing digest and the local UID derivation. `shortHash` (`sha256(...).slice(0, 32)`) is the UID format.

### Reading-mode rendering quirks

Several timeouts exist because Obsidian's renderer is async and lazy. All of these live in `src/pipeline/capture.ts` (the snapshot step) except the view-state restore, which is in `src/pipeline/share-service.ts`:

- The **600 ms wait** after `setViewState({mode: 'preview'})` is from issue [#162](https://github.com/alangrainger/share-note/discussions/162). Reading mode is "set" before it has finished rendering. Don't reduce this without manual testing.
- The **`applyScroll(0)` + 100 ms wait** before capturing element styles ensures `.markdown-preview-pusher`'s top margin reflects the unscrolled state (banner themes read this).
- The **`sampleRenderedHtml` polling loop** in `capture.ts` waits for enough of the tail sections of a long note to render before reading them. This is the trickiest part of the pipeline — if a long note publishes with empty sections at the bottom, this is where to look. Constants (`RENDER_POLL_MAX_TICKS`, `SHORT_NOTE_SECTION_COUNT`, `RENDER_TAIL_WINDOW`, `RENDER_TAIL_RENDERED_THRESHOLD`) are tuned empirically; the comments explain each.

Reading mode is restored at the end via `leaf.setViewState(startMode)` with a 200 ms timeout — required even though `setViewState` is awaited. The restore happens in the orchestrator (`ShareService.share`), not in capture, because capture has no business knowing about restoration.

### Undocumented Obsidian APIs

The plugin reaches into a few Obsidian internals. These are marked with `@ts-ignore` / `@ts-expect-error` and are the most likely things to break when Obsidian updates:

- `app.workspace.getActiveFileView()` — used instead of `getLeaf()` because the latter doesn't return `previewMode` on pinned notes. Called inside `ShareService.share()` (`src/pipeline/share-service.ts`).
- `leaf.view.previewMode.applyScroll(0)` — used to scroll to top before capture. In `src/pipeline/capture.ts`.
- `leaf.view.modes.preview.renderer` — the `sections[]` array we poll, plus `parsing`, `previewEl`, `pusherEl`. In `src/pipeline/capture.ts`; the local typing is the `Renderer` / `ViewModes` interface in the same file.
- `app.customCss.theme` — the currently-selected theme name, captured inside the `recordUploadedTheme` callback wired by `ShareService` so the upload-css step can record it on the server.
- `app.plugins.getPlugin('obsidian-excalidraw-plugin').ea.createSVG(filesource)` — for rendering Excalidraw drawings to SVG at share time. Wired by `ShareService` into the `getExcalidrawSvg` callback that `uploadMedia` uses, so `upload-media.ts` itself doesn't touch `app.plugins`.

If a plugin release breaks after an Obsidian update, this list is the first place to check.

### Frontmatter API

The user-facing per-note controls live in frontmatter. The prefix is configurable (`settings.yamlField`, default `share`), and `YamlField` enumerates the suffixes:

| Frontmatter key (default) | Type | Purpose |
|---|---|---|
| `share_link` | string | Set by the plugin after upload. Editing/removing this disconnects the note from its published copy. |
| `share_updated` | datetime | Set by the plugin after upload. |
| `share_unencrypted` | checkbox | Per-note override: publish without encryption. |
| `share_encrypted` | checkbox | Per-note override: force encryption even when the global default is unencrypted. Wins over `share_unencrypted` if both are set. |
| `share_title` | string | Source of the title when "Frontmatter property" is the configured title source. |
| `share_expires` | string | Per-note expiry, e.g. `"7 days"` (units: `minute`, `hour`, `day`, `month`). Overrides the global default. |

Always build these via `buildFieldKey(yamlField, YamlField.x)` from `src/domain/field-keys.ts` — never hardcode `"share_link"`, because the prefix is user-configurable. `SharePlugin.field(key)` and `ShareService.field(key)` are one-line delegates to that helper.

### File deduplication is core, not optimisation

The check-files-then-upload-missing pattern in `API.processQueue` is the whole reason re-shares are fast. The plugin sends `{hash, filetype, byteLength}` for every queued item; the server returns a URL for the ones it already has, and the plugin only POSTs the missing bytes. **Don't introduce code paths that bypass `check-files` and upload directly.** The one fully unguarded upload path is `createNote` itself — the rendered HTML always uploads, because by definition it's per-note. (CSS uploads via `api.upload()` skip a fresh `check-files` call, but they're still gated client-side by comparing `cssHash` against the value `check-files` returned earlier in the run — see step 9.)

CSS is gated separately (`!options.isForceUpload && cssResult` short-circuits inside `uploadCss`) — see "How it works" step 9.

### Build & release

- `npm run dev` — esbuild watch (writes `main.js` with inline sourcemaps).
- `npm run build` — lint, type-check (`tsc -noEmit`), then esbuild production.
- `npm version <patch|minor|major>` — bumps `manifest.json` and `versions.json` via `version-bump.mjs` (the npm `version` lifecycle hook). The bundled `main.js` is committed to the repo because that's how Obsidian community plugins ship.
- `versions.json` is a `{pluginVersion: minObsidianVersion}` map used by Obsidian's plugin store to pick a compatible plugin for older app versions. It's kept in sync with `manifest.json#minAppVersion` automatically by the version-bump script.
- `.hotreload` in the repo root is a marker file used by the [Hot Reload plugin](https://github.com/pjeby/hot-reload) so this directory reloads when `main.js` changes during dev — only relevant if the plugin is symlinked into a real vault's `.obsidian/plugins/` directory.

### Things that look like bugs but aren't

- `resolveSharedLink(linkText)` on `ShareService` returns `undefined` on lookup failure (the called Obsidian API can throw on missing files). That's by design — best-effort link rewriting; `rewriteLinks` falls through to "remove the link, keep the text".
- The byte-length header on uploaded SVG strings (Excalidraw) is intentionally omitted - `FileUpload.byteLength` is optional, and `string.length` isn't a meaningful byte count for arbitrary text. The header is gated on truthiness in `api.ts`.
- `ShareService.share()` doesn't restore the original view-state when capture fails - only on the success path. Preserved from the original behaviour. If you want to change this, do it intentionally.

---

## Asking for help

- **Bugs / feature requests:** <https://github.com/alangrainger/share-note/issues>
- **Roadmap:** <https://note.sx/roadmap>
- **User troubleshooting:** <https://docs.note.sx/troubleshooting>
- **System status:** <https://status.note.sx/>
- **Forum discussion:** <https://forum.obsidian.md/t/42788>
