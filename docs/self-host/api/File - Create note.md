---
title: /v1/file/create-note
grand_parent: Running your own server
parent: API
permalink: /self-hosting/api/file/create-note
---
# {{ page.title }}

```typescript
interface NoteData {
  filename: string
  filetype: string
  hash: string
  expiration?: number
  template: NoteTemplate
}
```

```typescript
interface NoteTemplate {
  filename: string
  title: string
  description: string
  width: string
  elements: ElementStyle[]
  encrypted: boolean
  content: string
  mathJax: boolean
}
```

```typescript
interface ElementStyle {
  element: string
  classes: string[]
  style: string
}
```