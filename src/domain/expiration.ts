const UNIT_MS: Record<string, number> = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  // Month is approximated as 30 days. The previous implementation used
  // moment().add(N, 'months') which is calendar-aware; for an auto-delete
  // timestamp the few-day difference is not user-visible.
  month: 30 * 24 * 60 * 60 * 1000
}

/**
 * Parse an expiry string of the form `"<N> <unit>"` (e.g. `"3 days"`,
 * `"1 month"`) into an absolute timestamp in milliseconds.
 *
 * Returns `undefined` if input is empty, malformed, or uses an unsupported
 * unit. Supported units: minute, hour, day, month (with optional `s` suffix).
 *
 * @param input  The raw string from a frontmatter property or settings.
 * @param now    The current time as ms-since-epoch. Defaults to `Date.now()`;
 *               injectable for tests.
 */
export function parseExpiration (input: string | undefined, now: number = Date.now()): number | undefined {
  if (!input) return undefined
  const match = input.match(/^(\d+) ([a-z]+?)s?$/)
  if (!match) return undefined
  const unitMs = UNIT_MS[match[2]]
  if (unitMs === undefined) return undefined
  return now + Number(match[1]) * unitMs
}
