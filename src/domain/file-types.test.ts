import { describe, it, expect } from 'vitest'
import {
  getFromMimetype,
  getFromExtension,
  getFromSignature,
  primaryMimetype
} from './file-types'

describe('getFromMimetype', () => {
  it('finds a type by its primary mimetype', () => {
    expect(getFromMimetype('font/woff2')?.extension).toBe('woff2')
  })

  it('finds a type by an alternative mimetype', () => {
    expect(getFromMimetype('application/x-font-truetype')?.extension).toBe('ttf')
  })

  it('returns undefined for an unknown mimetype', () => {
    expect(getFromMimetype('application/octet-stream')).toBeUndefined()
  })
})

describe('getFromExtension', () => {
  it('looks up by extension', () => {
    expect(getFromExtension('woff')?.mimetypes).toContain('font/woff')
  })

  it('is case-insensitive', () => {
    expect(getFromExtension('WOFF2')?.extension).toBe('woff2')
  })

  it('returns undefined for an unknown extension', () => {
    expect(getFromExtension('png')).toBeUndefined()
  })
})

describe('getFromSignature', () => {
  it('detects OTTO signature as otf', () => {
    const bytes = new Uint8Array([0x4F, 0x54, 0x54, 0x4F, 0x00])
    expect(getFromSignature(bytes)?.extension).toBe('otf')
  })

  it('detects wOFF signature as woff', () => {
    const bytes = new Uint8Array([0x77, 0x4F, 0x46, 0x46, 0x00])
    expect(getFromSignature(bytes)?.extension).toBe('woff')
  })

  it('detects wOF2 signature as woff2', () => {
    const bytes = new Uint8Array([0x77, 0x4F, 0x46, 0x32, 0x00])
    expect(getFromSignature(bytes)?.extension).toBe('woff2')
  })

  it('returns undefined for an unrecognised signature', () => {
    const bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]) // JPEG
    expect(getFromSignature(bytes)).toBeUndefined()
  })

  it('accepts an ArrayBuffer', () => {
    const buf = new Uint8Array([0x4F, 0x54, 0x54, 0x4F, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]).buffer
    expect(getFromSignature(buf)?.extension).toBe('otf')
  })
})

describe('primaryMimetype', () => {
  it('returns the first mimetype in the list', () => {
    const t = getFromExtension('ttf')!
    expect(primaryMimetype(t)).toBe('font/ttf')
  })
})
