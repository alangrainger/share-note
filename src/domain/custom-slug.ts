import { ShareError } from '../shared/errors'

/** The public service never accepts custom-slug requests. Fail closed on invalid URLs. */
export function isSelfHostedServer (server: string): boolean {
  try {
    const url = new URL(server)
    const host = url.hostname.toLowerCase().replace(/\.$/, '')
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password &&
      host !== 'note.sx' && !host.endsWith('.note.sx')
  } catch {
    return false
  }
}

export function resolveCustomSlug (value: unknown, enabled: boolean, previousFilename?: string): string | undefined {
  if (!enabled || value === undefined || value === null || value === '') return undefined
  if (typeof value === 'string' && value.trim() === '') return undefined
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/.test(value)) {
    throw new ShareError('Invalid custom slug: use 2-64 uppercase or lowercase letters, numbers, underscores, or hyphens, starting with a letter or number.')
  }
  if (previousFilename && previousFilename !== value) {
    throw new ShareError('The slug of a shared note cannot be changed. Restore its original slug or remove the slug property.')
  }
  return value
}
