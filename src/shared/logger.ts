const PREFIX = '[Share Note]'

// The Obsidian plugin guidelines discourage `console.info` and routine
// `console.log`. Errors are always acceptable; warnings are appropriate
// for unexpected-but-recoverable conditions. Anything informational
// should be gated behind a debug flag (added in a later phase).
export const logger = {
  warn (...args: unknown[]) {
    console.warn(PREFIX, ...args)
  },
  error (...args: unknown[]) {
    console.error(PREFIX, ...args)
  }
}
