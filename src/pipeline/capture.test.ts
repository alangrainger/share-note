import { describe, it, expect, vi, afterEach } from 'vitest'
import { collectCssRules } from './capture'

interface FakeSheetOptions {
  id?: string
  href?: string
  rules?: string[]
  throws?: boolean
}

// Minimal stand-in for CSSStyleSheet: only the members collectCssRules reads.
function fakeSheet (opts: FakeSheetOptions): CSSStyleSheet {
  const sheet = {
    href: opts.href ?? null,
    ownerNode: opts.id ? { id: opts.id } : null,
    get cssRules () {
      if (opts.throws) throw new DOMException('Cannot access rules', 'SecurityError')
      return (opts.rules ?? []).map(cssText => ({ cssText }))
    }
  }
  return sheet as unknown as CSSStyleSheet
}

const cssText = (rules: CSSRule[]) => rules.map(r => r.cssText)

describe('collectCssRules', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('collects the rules of every sheet in document order', () => {
    const rules = collectCssRules([
      fakeSheet({ rules: ['a{}', 'b{}'] }),
      fakeSheet({ rules: ['c{}'] })
    ])
    expect(cssText(rules)).toEqual(['a{}', 'b{}', 'c{}'])
  })

  it('skips the MathJax per-glyph stylesheet', () => {
    const rules = collectCssRules([
      fakeSheet({ id: 'MJX-CHTML-styles', rules: ['mjx{}'] }),
      fakeSheet({ rules: ['a{}'] })
    ])
    expect(cssText(rules)).toEqual(['a{}'])
  })

  it('skips a sheet whose rules cannot be read and keeps the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rules = collectCssRules([
      fakeSheet({ rules: ['a{}'] }),
      fakeSheet({ href: 'https://fonts.example/x.css', throws: true }),
      fakeSheet({ rules: ['b{}'] })
    ])
    expect(cssText(rules)).toEqual(['a{}', 'b{}'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]).toContain('https://fonts.example/x.css')
  })
})
