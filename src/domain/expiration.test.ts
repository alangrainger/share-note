import { describe, it, expect } from 'vitest'
import { parseExpiration } from './expiration'

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

  it('parses month as 30 days', () => {
    expect(parseExpiration('1 month', NOW)).toBe(NOW + 30 * 24 * 60 * 60 * 1000)
  })

  it('returns undefined for an unsupported unit', () => {
    expect(parseExpiration('5 years', NOW)).toBeUndefined()
    expect(parseExpiration('5 weeks', NOW)).toBeUndefined()
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
