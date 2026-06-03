import { sleep } from './sleep'

export interface PollOptions {
  // Milliseconds to wait between attempts.
  interval: number
  // Total milliseconds before giving up.
  timeout: number
}

/**
 * Poll `predicate` until it returns a truthy value, or `timeout` elapses.
 * Returns the truthy value, or `undefined` on timeout.
 */
export async function poll<T> (
  predicate: () => T | Promise<T>,
  opts: PollOptions
): Promise<T | undefined> {
  const start = Date.now()
  while (Date.now() - start < opts.timeout) {
    const result = await predicate()
    if (result) return result
    await sleep(opts.interval)
  }
  return undefined
}
