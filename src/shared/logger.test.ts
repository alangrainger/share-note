import { describe, it, expect, vi } from 'vitest'
import { logger } from './logger'

describe('logger', () => {
  it('prefixes error messages with [Share Note]', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    logger.error('boom', { detail: 1 })
    expect(spy).toHaveBeenCalledWith('[Share Note]', 'boom', { detail: 1 })
    spy.mockRestore()
  })

  it('prefixes warn messages with [Share Note]', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    logger.warn('careful')
    expect(spy).toHaveBeenCalledWith('[Share Note]', 'careful')
    spy.mockRestore()
  })
})
