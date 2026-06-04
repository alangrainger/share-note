/**
 * Replace the inline SVG icons inside `.callout` blocks with a placeholder
 * SVG carrying `data-share-note-lucide="<name>"`. The shared note renderer
 * uses that attribute to inject the right Lucide icon at view time.
 *
 * Icon names are looked up from the captured stylesheet's `--callout-icon`
 * CSS variable. If a per-callout-type rule isn't found, the generic
 * `.callout` default is used; if even that's missing we fall back to "pencil".
 */
export function fixCalloutIcons (doc: Document, cssRules: CSSRule[]): void {
  const defaultIcon = findCalloutIcon(cssRules, s => s === '.callout') || 'pencil'
  for (const el of doc.getElementsByClassName('callout')) {
    const type = el.getAttribute('data-callout')
    let icon = findCalloutIcon(cssRules, s => s.includes(`data-callout="${type}"`)) || defaultIcon
    icon = icon.replace('lucide-', '')

    const iconEl = el.querySelector('div.callout-icon')
    const svgEl = iconEl?.querySelector('svg')
    if (!svgEl) continue

    const newSvg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    newSvg.setAttribute('width', '16')
    newSvg.setAttribute('height', '16')
    newSvg.setAttribute('data-share-note-lucide', icon)
    svgEl.replaceWith(newSvg)
  }
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
