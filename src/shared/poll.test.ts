import { describe, it, expect } from 'vitest'
import { poll } from './poll'

describe('poll', () => {
  it('resolves with the value when the predicate first returns truthy', async () => {
    let count = 0
    const result = await poll(
      () => ++count >= 3 ? 'done' : undefined,
      { interval: 10, timeout: 1000 }
    )
    expect(result).toBe('done')
    expect(count).toBe(3)
  })

  it('returns undefined when the timeout elapses', async () => {
    const result = await poll(() => undefined, { interval: 10, timeout: 50 })
    expect(result).toBeUndefined()
  })

  it('awaits async predicates', async () => {
    let count = 0
    const result = await poll(
      async () => {
        await new Promise(resolve => window.setTimeout(resolve, 5))
        return ++count >= 2 ? 'async-done' : undefined
      },
      { interval: 10, timeout: 1000 }
    )
    expect(result).toBe('async-done')
  })
})
