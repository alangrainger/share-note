import { describe, it, expect } from 'vitest'
import { buildSource, BuildSourceContext } from './build-source'

const HOSTED: Record<string, string> = {
  'img.png': 'https://share.note.sx/file/abc.png',
  'my image.png': 'https://share.note.sx/file/def.png'
}
const SHARED: Record<string, string> = {
  'Other note': 'https://share.note.sx/xyz'
}

function ctx (overrides: Partial<BuildSourceContext> = {}): BuildSourceContext {
  return {
    fieldPrefix: 'share',
    resolveEmbed: async (target) => HOSTED[target],
    resolveSharedLink: (target) => SHARED[target],
    ...overrides
  }
}

describe('buildSource frontmatter', () => {
  it('strips share_* keys and keeps the rest', async () => {
    const md = '---\ntitle: Hi\nshare_link: https://x\nshare_updated: 2026-01-01\ntags: [a]\n---\nBody'
    expect(await buildSource(md, ctx())).toBe('---\ntitle: Hi\ntags: [a]\n---\nBody')
  })

  it('honours a custom prefix', async () => {
    const md = '---\ncustom_link: https://x\nshare_link: keep\n---\nBody'
    expect(await buildSource(md, ctx({ fieldPrefix: 'custom' }))).toBe('---\nshare_link: keep\n---\nBody')
  })

  it('drops the block entirely when only share keys were in it', async () => {
    const md = '---\nshare_link: https://x\nshare_updated: 2026-01-01\n---\n# Body'
    expect(await buildSource(md, ctx())).toBe('# Body')
  })

  it('leaves a note without frontmatter alone', async () => {
    expect(await buildSource('# Just body', ctx())).toBe('# Just body')
  })

  it('does not treat a horizontal rule later in the note as frontmatter', async () => {
    const md = 'Intro\n---\nshare_link: x\n---\n'
    expect(await buildSource(md, ctx())).toBe(md)
  })
})

describe('buildSource embeds', () => {
  it('rewrites wiki embeds with and without alias', async () => {
    const md = '![[img.png|alt text]] and ![[img.png]]'
    expect(await buildSource(md, ctx())).toBe(
      '![alt text](https://share.note.sx/file/abc.png) and ![](https://share.note.sx/file/abc.png)'
    )
  })

  it('rewrites markdown embeds and decodes the path', async () => {
    const md = '![alt](img.png) ![two](my%20image.png)'
    expect(await buildSource(md, ctx())).toBe(
      '![alt](https://share.note.sx/file/abc.png) ![two](https://share.note.sx/file/def.png)'
    )
  })

  it('leaves note embeds, unresolved embeds and web images unchanged', async () => {
    const md = '![[Other note]] ![[missing.png]] ![web](https://example.com/a.png)'
    expect(await buildSource(md, ctx())).toBe(md)
  })
})

describe('buildSource wikilinks', () => {
  it('rewrites shared wikilinks with and without alias', async () => {
    const md = 'See [[Other note]] and [[Other note|that one]] and [[Other note#Heading]]'
    expect(await buildSource(md, ctx())).toBe(
      'See [Other note](https://share.note.sx/xyz) and [that one](https://share.note.sx/xyz) and [Other note](https://share.note.sx/xyz)'
    )
  })

  it('leaves unshared wikilinks unchanged', async () => {
    const md = 'See [[Private note]] and [[Private note|alias]]'
    expect(await buildSource(md, ctx())).toBe(md)
  })
})
