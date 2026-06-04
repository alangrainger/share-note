/**
 * Replace the inline SVG icons inside `.callout` blocks with a placeholder
 * SVG carrying `data-share-note-lucide="<name>"`. The shared note renderer
 * uses that attribute to inject the right Lucide icon at view time.
 *
 * Icon-name resolution, in order of preference:
 *
 * 1. The rendered SVG's `lucide-<name>` class. This is authoritative: it's
 *    the name Obsidian actually used when drawing the icon. Required for
 *    callout types whose `--callout-icon` CSS variable is an Obsidian
 *    internal glyph name (e.g. `quote-glyph`) rather than a Lucide name.
 * 2. A type-specific `--callout-icon` CSS variable on the captured rule.
 *    Used when the SVG carries no Lucide class - mostly relevant if Obsidian
 *    changes its class scheme.
 * 3. The generic `.callout` default `--callout-icon`.
 * 4. `pencil` as a last resort.
 */
export function fixCalloutIcons (doc: Document, cssRules: CSSRule[]): void {
  const defaultIcon = stripLucidePrefix(findCalloutIcon(cssRules, s => s === '.callout')) || 'pencil'
  for (const el of doc.getElementsByClassName('callout')) {
    const iconEl = el.querySelector('div.callout-icon')
    const svgEl = iconEl?.querySelector('svg')
    if (!svgEl) continue

    const fromSvg = lucideNameFromClassList(svgEl)
    const type = el.getAttribute('data-callout')
    const fromCss = stripLucidePrefix(findCalloutIcon(cssRules, s => s.includes(`data-callout="${type}"`)))
    const icon = fromSvg || fromCss || defaultIcon

    const newSvg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    newSvg.setAttribute('width', '16')
    newSvg.setAttribute('height', '16')
    newSvg.setAttribute('data-share-note-lucide', icon)
    svgEl.replaceWith(newSvg)
  }
}

function lucideNameFromClassList (svgEl: Element): string | undefined {
  for (const cls of Array.from(svgEl.classList)) {
    if (cls.startsWith('lucide-')) return cls.slice('lucide-'.length)
  }
  return undefined
}

function stripLucidePrefix (value: string): string {
  return value.replace(/^lucide-/, '')
}

function findCalloutIcon (cssRules: CSSRule[], match: (selectorText: string) => boolean): string {
  const rule = cssRules.find(r => {
    const styleRule = r as CSSStyleRule
    return styleRule.selectorText &&
      match(styleRule.selectorText) &&
      styleRule.style?.getPropertyValue('--callout-icon')
  }) as CSSStyleRule | undefined
  return rule?.style.getPropertyValue('--callout-icon') || ''
}
