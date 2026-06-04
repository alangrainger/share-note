// https://en.wikipedia.org/wiki/List_of_file_signatures

export interface FileType {
  extension: string
  mimetypes: string[]
  /** Magic bytes at offset 0. Some types (e.g. SVG, plain XML) have no fixed signature. */
  signature?: Uint8Array
}

/**
 * Allowed asset types in shared CSS (web fonts and SVG). The plugin only
 * inlines/uploads attachments whose extension or mimetype is in this list -
 * other types are silently skipped.
 */
const TYPES: readonly FileType[] = [
  {
    extension: 'ttf',
    mimetypes: ['font/ttf', 'application/x-font-ttf', 'application/x-font-truetype', 'font/truetype'],
    signature: new Uint8Array([0x00, 0x01, 0x00, 0x00, 0x00])
  },
  {
    extension: 'otf',
    mimetypes: ['font/otf', 'application/x-font-opentype'],
    signature: new Uint8Array([0x4F, 0x54, 0x54, 0x4F])
  },
  {
    extension: 'woff',
    mimetypes: ['font/woff', 'application/font-woff', 'application/x-font-woff'],
    signature: new Uint8Array([0x77, 0x4F, 0x46, 0x46])
  },
  {
    extension: 'woff2',
    mimetypes: ['font/woff2', 'application/font-woff2', 'application/x-font-woff2'],
    signature: new Uint8Array([0x77, 0x4F, 0x46, 0x32])
  },
  {
    extension: 'svg',
    mimetypes: ['image/svg+xml']
  }
] as const

/** The primary (preferred) mimetype for a known type. */
export function primaryMimetype (type: FileType): string {
  return type.mimetypes[0]
}

export function getFromMimetype (mimetype: string): FileType | undefined {
  return TYPES.find(t => t.mimetypes.includes(mimetype))
}

export function getFromExtension (extension: string): FileType | undefined {
  return TYPES.find(t => t.extension === extension.toLowerCase())
}

/**
 * Detect a file's type by inspecting magic bytes at the start of the buffer.
 * Returns `undefined` for types without a fixed signature (e.g. SVG).
 */
export function getFromSignature (signature: Uint8Array | ArrayBuffer): FileType | undefined {
  const bytes = signature instanceof ArrayBuffer
    ? new Uint8Array(signature, 0, 10)
    : signature
  return TYPES.find(t => t.signature && startsWith(bytes, t.signature))
}

function startsWith (haystack: Uint8Array, needle: Uint8Array): boolean {
  for (let i = 0; i < needle.length; i++) {
    if (needle[i] !== haystack[i]) return false
  }
  return true
}
