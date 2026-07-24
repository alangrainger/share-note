import { describe, it, expect } from 'vitest'
import {
  isValidFileExtension,
  detectMediaTypeFromMime,
  detectMediaTypeFromSignature
} from './upload-media'

describe('isValidFileExtension', () => {
  it('accepts short alphanumeric extensions', () => {
    expect(isValidFileExtension('png')).toBe(true)
    expect(isValidFileExtension('jpeg')).toBe(true)
    expect(isValidFileExtension('webm')).toBe(true)
  })

  it('rejects UUID-like or long path segments from blob URLs', () => {
    expect(isValidFileExtension('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(false)
    expect(isValidFileExtension('toolongextension')).toBe(false)
    expect(isValidFileExtension(undefined)).toBe(false)
    expect(isValidFileExtension('')).toBe(false)
  })
})

describe('detectMediaTypeFromMime', () => {
  it('maps common image/video mimetypes', () => {
    expect(detectMediaTypeFromMime('image/png')).toBe('png')
    expect(detectMediaTypeFromMime('image/jpeg; charset=binary')).toBe('jpg')
    expect(detectMediaTypeFromMime('video/mp4')).toBe('mp4')
  })

  it('returns undefined for unknown types', () => {
    expect(detectMediaTypeFromMime('application/octet-stream')).toBeUndefined()
    expect(detectMediaTypeFromMime(null)).toBeUndefined()
  })
})

describe('detectMediaTypeFromSignature', () => {
  it('detects PNG', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    expect(detectMediaTypeFromSignature(bytes.buffer)).toBe('png')
  })

  it('detects JPEG', () => {
    const bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])
    expect(detectMediaTypeFromSignature(bytes.buffer)).toBe('jpg')
  })

  it('detects GIF', () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    expect(detectMediaTypeFromSignature(bytes.buffer)).toBe('gif')
  })

  it('detects WebP', () => {
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50
    ])
    expect(detectMediaTypeFromSignature(bytes.buffer)).toBe('webp')
  })

  it('detects SVG text', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
    const bytes = new TextEncoder().encode(svg)
    expect(detectMediaTypeFromSignature(bytes.buffer)).toBe('svg')
  })

  it('returns undefined for unrecognised content', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05])
    expect(detectMediaTypeFromSignature(bytes.buffer)).toBeUndefined()
  })
})
