import { describe, it, expect } from 'vitest'
import { resolveIncludeSource } from './source-policy'

const sourceKey = 'share_source'

describe('resolveIncludeSource', () => {
  it('follows the setting when frontmatter has no override', () => {
    expect(resolveIncludeSource({ defaultInclude: false, frontmatter: undefined, sourceKey })).toBe(false)
    expect(resolveIncludeSource({ defaultInclude: true, frontmatter: {}, sourceKey })).toBe(true)
  })

  it('frontmatter true overrides a false setting', () => {
    expect(resolveIncludeSource({ defaultInclude: false, frontmatter: { share_source: true }, sourceKey })).toBe(true)
  })

  it('frontmatter false overrides a true setting', () => {
    expect(resolveIncludeSource({ defaultInclude: true, frontmatter: { share_source: false }, sourceKey })).toBe(false)
  })

  it('ignores non-boolean frontmatter values', () => {
    expect(resolveIncludeSource({ defaultInclude: false, frontmatter: { share_source: 'yes' }, sourceKey })).toBe(false)
    expect(resolveIncludeSource({ defaultInclude: true, frontmatter: { share_source: 0 }, sourceKey })).toBe(true)
  })
})
