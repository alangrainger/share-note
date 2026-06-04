import { describe, it, expect } from 'vitest'
import { ShareError, NetworkError, AuthError, UploadError } from './errors'

describe('ShareError', () => {
  it('defaults handled to false', () => {
    const e = new ShareError('boom')
    expect(e.handled).toBe(false)
    expect(e.message).toBe('boom')
    expect(e.name).toBe('ShareError')
  })

  it('preserves the cause when provided', () => {
    const cause = new Error('underlying')
    const e = new ShareError('wrapper', { cause })
    expect(e.cause).toBe(cause)
  })

  it('marks handled errors so the top-level catch can stay silent', () => {
    const e = new ShareError('already shown', { handled: true })
    expect(e.handled).toBe(true)
  })
})

describe('NetworkError', () => {
  it('carries an HTTP status', () => {
    const e = new NetworkError('server says no', { status: 500 })
    expect(e).toBeInstanceOf(ShareError)
    expect(e.status).toBe(500)
    expect(e.name).toBe('NetworkError')
  })
})

describe('AuthError', () => {
  it('is a NetworkError so generic catches still match', () => {
    const e = new AuthError('need a fresh key', { status: 462, handled: true })
    expect(e).toBeInstanceOf(NetworkError)
    expect(e).toBeInstanceOf(ShareError)
    expect(e.status).toBe(462)
    expect(e.handled).toBe(true)
  })
})

describe('UploadError', () => {
  it('is a ShareError but not a NetworkError', () => {
    const e = new UploadError('image failed')
    expect(e).toBeInstanceOf(ShareError)
    expect(e).not.toBeInstanceOf(NetworkError)
    expect(e.name).toBe('UploadError')
  })
})
