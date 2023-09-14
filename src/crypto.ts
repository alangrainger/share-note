// noinspection JSUnusedGlobalSymbols

export interface EncryptedString {
  ciphertext: string[];
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
  const iv = window.crypto.getRandomValues(new Uint8Array(16))
  const aesKey = await _getAesGcmKey(key)

  const ciphertext = []
  const length = plaintext.length
  const chunkSize = 1000
  let index = 0
  while (index * chunkSize < length) {
    const plaintextChunk = plaintext.slice(index * chunkSize, (index + 1) * chunkSize)
    console.log(plaintextChunk)
    const encodedText = new TextEncoder().encode(plaintextChunk)
    const bufCiphertext: ArrayBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encodedText
    )
    ciphertext.push(arrayBufferToBase64(bufCiphertext))
    index++
  }

  return {
    ciphertext,
    iv: arrayBufferToBase64(iv),
    key: masterKeyToString(key).slice(0, 43)
  }
}

export async function decryptString (encryptedData: EncryptedString) {
  const ivBuf = base64ToArrayBuffer(encryptedData.iv)
  const aesKey = await window.crypto.subtle.importKey('raw', base64ToArrayBuffer(encryptedData.key), {
    name: 'AES-GCM',
    length: 256
  }, false, ['decrypt'])

  const plaintext = []

  for (const ciphertextChunk of encryptedData.ciphertext) {
    const ciphertextBuf = base64ToArrayBuffer(ciphertextChunk)
    const plaintextChunk = await window.crypto.subtle
      .decrypt({ name: 'AES-GCM', iv: ivBuf }, aesKey, ciphertextBuf)
    plaintext.push(new TextDecoder().decode(plaintextChunk))
  }
  return plaintext.join('')
}

async function sha256 (text: string) {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hash (text: string) {
  return (await sha256(text)).slice(0, 32)
}
