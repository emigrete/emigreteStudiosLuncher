import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Cripto para el refresh token, pura (sin electron) y por eso testeable.
 *
 * El launcher prefiere `safeStorage` del SO (encriptación real: DPAPI en Windows,
 * keychain en Mac, keyring en Linux). Cuando el SO no ofrece keyring, cae a este
 * fallback: AES-256-GCM con una clave local (guardada 0600). No es tan fuerte como
 * el keyring (la clave vive en el disco del usuario), pero evita texto plano y
 * funciona en todos lados. El primer byte del blob marca con qué método se cifró.
 */

export const TAG_SAFE_STORAGE = 1
export const TAG_LOCAL_AES = 2

export const LOCAL_KEY_BYTES = 32 // AES-256
const IV_LEN = 12 // GCM nonce
const AUTH_TAG_LEN = 16

/** AES-256-GCM. Devuelve `iv(12) || authTag(16) || ciphertext`. */
export function localEncrypt(plaintext: string, key: Buffer): Buffer {
  if (key.length !== LOCAL_KEY_BYTES) throw new Error(`La clave local debe ser de ${LOCAL_KEY_BYTES} bytes.`)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext])
}

/** Descifra lo producido por `localEncrypt`. Tira si la clave es otra o el blob fue alterado (GCM). */
export function localDecrypt(blob: Buffer, key: Buffer): string {
  if (key.length !== LOCAL_KEY_BYTES) throw new Error(`La clave local debe ser de ${LOCAL_KEY_BYTES} bytes.`)
  if (blob.length < IV_LEN + AUTH_TAG_LEN) throw new Error('Blob local demasiado corto.')
  const iv = blob.subarray(0, IV_LEN)
  const authTag = blob.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN)
  const ciphertext = blob.subarray(IV_LEN + AUTH_TAG_LEN)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/** Antepone un byte de método al payload, para saber cómo descifrar al cargar. */
export function frame(tag: number, payload: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), payload])
}

/** Separa el byte de método del payload. */
export function unframe(buf: Buffer): { tag: number; payload: Buffer } {
  if (buf.length < 1) throw new Error('Buffer vacío.')
  return { tag: buf[0], payload: buf.subarray(1) }
}
