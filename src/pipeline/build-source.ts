export interface BuildSourceContext {
  /** The user's frontmatter prefix (e.g. "share"). Keys `<prefix>_*` are stripped. */
  fieldPrefix: string
  /**
   * Resolve an embed target (the vault path or link text inside `![[...]]`
   * or `![](...)`) to its hosted URL, if the asset was uploaded. Async so
   * the caller can hash the vault file on demand.
   */
  resolveEmbed: (target: string) => Promise<string | undefined>
  /** Resolve a wikilink target to the public URL of its shared note, if any. */
  resolveSharedLink: (target: string) => string | undefined
}

/**
 * Prepare a note's raw Markdown for embedding in the shared page:
 *
 *   1. Strip every `<prefix>_*` key from the frontmatter block, so the
 *      recipient does not inherit the author's share link. The block is
 *      removed entirely if nothing else is in it.
 *   2. Rewrite image/attachment embeds (`![[file|alias]]`, `![alt](path)`)
 *      to the hosted URL the asset was uploaded to, keeping the alias/alt.
 *      Embeds that do not resolve - note embeds, web images, Excalidraw -
 *      are left exactly as written.
 *   3. Rewrite `[[Note]]` / `[[Note|alias]]` links whose target has its own
 *      share link to `[alias](share-url)`. Other wikilinks are left alone;
 *      the recipient may well own that note.
 */
export async function buildSource (markdown: string, ctx: BuildSourceContext): Promise<string> {
  let out = stripShareFrontmatter(markdown, ctx.fieldPrefix)
  out = await rewriteWikiEmbeds(out, ctx)
  out = await rewriteMarkdownEmbeds(out, ctx)
  out = rewriteSharedWikilinks(out, ctx)
  return out
}

const FRONTMATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/

function stripShareFrontmatter (markdown: string, prefix: string): string {
  const match = markdown.match(FRONTMATTER_BLOCK)
  if (!match) return markdown
  const keyPrefix = `${prefix}_`
  const kept = match[1]
    .split(/\r?\n/)
    .filter(line => !line.startsWith(keyPrefix))
  const rest = markdown.slice(match[0].length)
  if (kept.every(line => line.trim() === '')) return rest
  return `---\n${kept.join('\n')}\n---\n${rest}`
}

/** Wiki embeds: `![[target]]` or `![[target|alias]]`. */
const WIKI_EMBED = /!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g
/** Markdown embeds: `![alt](target)`, excluding absolute web URLs. */
const MD_EMBED = /!\[([^\]]*)\]\((?!https?:\/\/)([^)\s]+)\)/g
/** Wikilinks that are not embeds: `[[target]]`, `[[target#heading|alias]]`. */
const WIKILINK = /(?<!!)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g

async function rewriteWikiEmbeds (markdown: string, ctx: BuildSourceContext): Promise<string> {
  return replaceAsync(markdown, WIKI_EMBED, async (whole, target, alias) => {
    const url = await ctx.resolveEmbed(target)
    return url ? `![${alias ?? ''}](${url})` : whole
  })
}

async function rewriteMarkdownEmbeds (markdown: string, ctx: BuildSourceContext): Promise<string> {
  return replaceAsync(markdown, MD_EMBED, async (whole, alt, target) => {
    const url = await ctx.resolveEmbed(safeDecode(target))
    return url ? `![${alt}](${url})` : whole
  })
}

function rewriteSharedWikilinks (markdown: string, ctx: BuildSourceContext): string {
  return markdown.replace(WIKILINK, (whole, target: string, alias?: string) => {
    const url = ctx.resolveSharedLink(target)
    return url ? `[${alias ?? target}](${url})` : whole
  })
}

/** Markdown-link paths are URL-encoded (`my%20image.png`); undo that for lookup. */
function safeDecode (path: string): string {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

/**
 * `String.replace` with an async replacer. Matches are resolved
 * sequentially and spliced back in order.
 */
async function replaceAsync (
  input: string,
  pattern: RegExp,
  replacer: (whole: string, ...groups: string[]) => Promise<string>
): Promise<string> {
  const matches = Array.from(input.matchAll(pattern))
  if (matches.length === 0) return input
  let out = ''
  let cursor = 0
  for (const m of matches) {
    const [whole, ...groups] = m
    out += input.slice(cursor, m.index) + await replacer(whole, ...groups)
    cursor = (m.index ?? 0) + whole.length
  }
  return out + input.slice(cursor)
}
