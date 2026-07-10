import { app, safeStorage } from 'electron'
import { join } from 'path'
import { readFile, writeFile, rm } from 'fs/promises'

/**
 * Persistencia del refresh token de Microsoft.
 *
 * Se cifra con `safeStorage` (keychain del SO). Si el SO no ofrece cifrado
 * (p. ej. Linux sin keyring), NO se persiste nada: preferimos pedir login de
 * nuevo antes que dejar un token de larga vida en texto plano.
 */

const FILE_NAME = 'session.bin'
const sessionFile = (): string => join(app.getPath('userData'), FILE_NAME)

let warned = false

export function canPersist(): boolean {
  const ok = safeStorage.isEncryptionAvailable()
  if (!ok && !warned) {
    warned = true
    console.warn('[auth] safeStorage no disponible: la sesión no se guardará entre arranques.')
  }
  return ok
}

export async function saveRefreshToken(token: string): Promise<boolean> {
  if (!canPersist()) return false
  await writeFile(sessionFile(), safeStorage.encryptString(token), { mode: 0o600 })
  return true
}

export async function loadRefreshToken(): Promise<string | null> {
  if (!canPersist()) return null
  try {
    const encrypted = await readFile(sessionFile())
    const token = safeStorage.decryptString(encrypted)
    return token.length > 0 ? token : null
  } catch {
    // No hay sesión guardada, o el keychain cambió y ya no se puede descifrar.
    return null
  }
}

export async function clearSession(): Promise<void> {
  await rm(sessionFile(), { force: true }).catch(() => undefined)
}
