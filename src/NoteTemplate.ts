export interface ElementStyle {
  element: string
  classes: string[]
  style: string
}

export function getElementStyle (key: string, element: HTMLElement) {
  const elementStyle: ElementStyle = {
    element: key,
    classes: [],
    style: ''
  }
  try {
    elementStyle.classes = Array.from(element.classList)
    const style = element.style
    if (element.classList.contains('markdown-preview-pusher')) {
      // Remove the bottom margin from the pusher. This is the element which pushes items down the
      // page. It can cause issues with a large blank section appearing before the shared content.
      // For themes which use banners, they appear to use the margin-top attribute.
      style.removeProperty('margin-bottom')
    }
    elementStyle.style = style.cssText
  } catch (e) {
    console.log(e)
  }
  return elementStyle
}

export default class NoteTemplate {
  filename: string
  title: string
  description: string
  width: string
  elements: ElementStyle[] = []
  encrypted: boolean
  content: string
  mathJax: boolean
  css?: Array<{
    url: string
    hash: string
  }>
}
