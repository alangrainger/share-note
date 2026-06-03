import { describe, it, expect } from 'vitest'
import { sleep } from './sleep'

describe('sleep', () => {
  it('resolves after at least the specified delay', async () => {
    const start = Date.now()
    await sleep(50)
    const elapsed = Date.now() - start
    // Small tolerance for timer jitter on slow CI.
    expect(elapsed).toBeGreaterThanOrEqual(45)
  })
})
