import { describe, it, expect } from 'vitest'
import { EXPIRATION_FORMAT_HINT, parseExpiration, validateExpiration } from './expiration'

const NOW = 1_700_000_000_000 // arbitrary fixed point

describe('parseExpiration', () => {
  it('returns undefined for empty input', () => {
    expect(parseExpiration(undefined, NOW)).toBeUndefined()
    expect(parseExpiration('', NOW)).toBeUndefined()
  })

  it('parses minute', () => {
    expect(parseExpiration('5 minutes', NOW)).toBe(NOW + 5 * 60 * 1000)
    expect(parseExpiration('1 minute', NOW)).toBe(NOW + 60 * 1000)
  })

  it('parses hour', () => {
    expect(parseExpiration('2 hours', NOW)).toBe(NOW + 2 * 60 * 60 * 1000)
  })

  it('parses day', () => {
    expect(parseExpiration('3 days', NOW)).toBe(NOW + 3 * 24 * 60 * 60 * 1000)
  })

  it('parses week', () => {
    expect(parseExpiration('1 week', NOW)).toBe(NOW + 7 * 24 * 60 * 60 * 1000)
    expect(parseExpiration('2 weeks', NOW)).toBe(NOW + 14 * 24 * 60 * 60 * 1000)
  })

  it('parses month as 30 days', () => {
    expect(parseExpiration('1 month', NOW)).toBe(NOW + 30 * 24 * 60 * 60 * 1000)
  })

  it('ignores surrounding whitespace and case', () => {
    expect(parseExpiration(' 7 days ', NOW)).toBe(NOW + 7 * 24 * 60 * 60 * 1000)
    expect(parseExpiration('1 Week', NOW)).toBe(NOW + 7 * 24 * 60 * 60 * 1000)
  })

  it('returns undefined for an unsupported unit', () => {
    expect(parseExpiration('5 years', NOW)).toBeUndefined()
  })

  it('returns undefined for malformed input', () => {
    expect(parseExpiration('nonsense', NOW)).toBeUndefined()
    expect(parseExpiration('day', NOW)).toBeUndefined()
    expect(parseExpiration('5', NOW)).toBeUndefined()
    expect(parseExpiration('5days', NOW)).toBeUndefined() // missing space
  })

  it('defaults `now` to Date.now() when not provided', () => {
    const before = Date.now()
    const result = parseExpiration('1 minute')
    const after = Date.now()
    expect(result).toBeDefined()
    expect(result!).toBeGreaterThanOrEqual(before + 60_000)
    expect(result!).toBeLessThanOrEqual(after + 60_000)
  })
})

describe('validateExpiration', () => {
  it('accepts empty input, meaning no expiry', () => {
    expect(validateExpiration(undefined)).toBeUndefined()
    expect(validateExpiration('')).toBeUndefined()
  })

  it('accepts a valid expiry', () => {
    expect(validateExpiration('1 week')).toBeUndefined()
  })

  it('returns the format hint for an invalid expiry', () => {
    expect(validateExpiration('7d')).toBe(EXPIRATION_FORMAT_HINT)
    expect(validateExpiration('1.5 hours')).toBe(EXPIRATION_FORMAT_HINT)
  })
})
