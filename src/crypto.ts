// noinspection JSUnusedGlobalSymbols

export interface EncryptedString {
  ciphertext: string[];
  ivs: string[];
  key: string;
}

export function masterKeyToString (masterKey: ArrayBuffer): string {
  return arrayBufferToBase64(masterKey)
}

export function arrayBufferToBase64 (buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

export function base64ToArrayBuffer (base64: string) {
  return Uint8Array.from(window.atob(base64), (c) => c.charCodeAt(0)).buffer
}

function _getAesGcmKey (secret: ArrayBuffer): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    'raw',
    secret,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt a plaintext string with AES 256
 *
 * @param {string} plaintext
 * @param {string} [existingKey] - Optional
 * @return {EncryptedString}
 */
export async function encryptString (plaintext: string, existingKey?: string): Promise<EncryptedString> {
  let key
  if (existingKey) {
    key = base64ToArrayBuffer(existingKey)
  } else {
    // 128-bit AES-GCM key. Generated directly from the CSPRNG - the bytes are
    // already uniformly random, so there's nothing for a KDF to add here.
    // 16 bytes encodes to a 22-char base64 fragment (vs 43 for the old 256-bit
    // key), keeping the share URL shorter. Re-shares reuse the existing key as
    // given, so older 256-bit keys keep working unchanged.
    key = window.crypto.getRandomValues(new Uint8Array(16)).buffer
  }
  const aesKey = await _getAesGcmKey(key)

  const ciphertext = []
  const ivs: string[] = []
  const length = plaintext.length
  const chunkSize = 2000
  let index = 0
  while (index * chunkSize < length) {
    const plaintextChunk = plaintext.slice(index * chunkSize, (index + 1) * chunkSize)
    const encodedText = new TextEncoder().encode(plaintextChunk)
    // Generate a fresh random IV per chunk. Reusing IVs with the same AES-GCM
    // key (as the previous deterministic indexToIv() scheme did across re-shares)
    // breaks confidentiality and can leak the GCM authentication subkey.
    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const bufCiphertext: ArrayBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encodedText
    )
    ciphertext.push(arrayBufferToBase64(bufCiphertext))
    ivs.push(arrayBufferToBase64(iv.buffer))
    index++
  }

  return {
    ciphertext,
    ivs,
    // Strip base64 padding rather than slicing to a fixed length: a fresh
    // 16-byte key yields 22 chars, while an older reused 32-byte key still
    // yields its full 43 chars. Hardcoding 22 would truncate (and break)
    // re-shares of notes that were first encrypted with a 256-bit key.
    key: masterKeyToString(key).replace(/=+$/, '')
  }
}

async function sha (algorithm: string, data: string | ArrayBuffer) {
  let uint8Array
  if (typeof data === 'string') {
    const encoder = new TextEncoder()
    uint8Array = encoder.encode(data)
  } else {
    uint8Array = data
  }
  const hash = await crypto.subtle.digest(algorithm, uint8Array)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256 (data: string | ArrayBuffer) {
  return sha('SHA-256', data)
}

export async function sha1 (data: string | ArrayBuffer) {
  return sha('SHA-1', data)
}

export async function shortHash (text: string) {
  return (await sha256(text)).slice(0, 32)
}
