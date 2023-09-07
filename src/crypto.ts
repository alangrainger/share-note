// Copied with thanks from https://github.com/mcndt/obsidian-quickshare

interface EncryptedData {
  ciphertext: string;
  iv: string;
}

export interface EncryptedString {
  ciphertext: string;
  key: string;
  iv: string;
}

async function _generateKey (seed: ArrayBuffer) {
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    seed,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const masterKey = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(16),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  )

  return new Uint8Array(masterKey)
}

export function masterKeyToString (masterKey: ArrayBuffer): string {
  return arrayBufferToBase64(masterKey)
}

export async function decryptString (
  { ciphertext, iv }: EncryptedData,
  secret: string
): Promise<string> {
  const ciphertextBuf = base64ToArrayBuffer(ciphertext)
  const ivBuf = base64ToArrayBuffer(iv)
  const plaintext = await window.crypto.subtle
    .decrypt(
      { name: 'AES-GCM', iv: ivBuf },
      await _getAesGcmKey(base64ToArrayBuffer(secret)),
      ciphertextBuf
    )
    .catch(() => {
      throw new Error('Cannot decrypt ciphertext with this key.')
    })
  return new TextDecoder().decode(plaintext)
}

export function arrayBufferToBase64 (buffer: ArrayBuffer): string {
  return window.btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

export function base64ToArrayBuffer (base64: string): ArrayBuffer {
  return Uint8Array.from(window.atob(base64), (c) => c.charCodeAt(0))
}

function _getAesGcmKey (secret: ArrayBuffer): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'AES-GCM', length: 256 },
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
    key = await _generateKey(window.crypto.getRandomValues(new Uint8Array(64)))
  }

  const encodedText = new TextEncoder().encode(plaintext)
  const iv = window.crypto.getRandomValues(new Uint8Array(16))
  const bufCiphertext: ArrayBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await _getAesGcmKey(key),
    encodedText
  )
  const ciphertext = arrayBufferToBase64(bufCiphertext)

  return {
    ciphertext,
    iv: arrayBufferToBase64(iv),
    key: masterKeyToString(key).slice(0, 43)
  }
}

async function sha256 (text: string) {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hash (path: string) {
  return (await sha256(path)).slice(0, 32)
}
