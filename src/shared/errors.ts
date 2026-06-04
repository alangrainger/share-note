// Hierarchy of errors raised inside the share pipeline.
//
// `handled` means a user-facing StatusMessage has already been shown at the
// throw site, so the top-level catch in main.ts can stay silent. Anything
// without that flag falls through to the generic "please try again" message.

export interface ShareErrorOptions {
  handled?: boolean
  cause?: unknown
}

export class ShareError extends Error {
  readonly handled: boolean

  constructor (message: string, options: ShareErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = this.constructor.name
    this.handled = options.handled ?? false
  }
}

export interface NetworkErrorOptions extends ShareErrorOptions {
  status?: number
}

export class NetworkError extends ShareError {
  readonly status?: number

  constructor (message: string, options: NetworkErrorOptions = {}) {
    super(message, options)
    this.status = options.status
  }
}

// Server reports an invalid or missing API key (HTTP 462).
export class AuthError extends NetworkError {}

// A single file/asset upload failed. Currently logged but not propagated;
// the surrounding share still completes with the asset missing.
export class UploadError extends ShareError {}
