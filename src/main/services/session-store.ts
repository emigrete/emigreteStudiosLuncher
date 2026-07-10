import { app, safeStorage } from 'electron'
import { join } from 'path'
import { readFile, writeFile, rm, open, chmod } from 'fs/promises'
import { randomBytes } from 'node:crypto'
import {
  TAG_SAFE_STORAGE,
  TAG_LOCAL_AES,
  LOCAL_KEY_BYTES,
  localEncrypt,
  localDecrypt,
  frame,
  unframe
} from './session-crypto'

/**
 * Persistencia del refresh token de Microsoft.
 *
 * Preferimos `safeStorage` del SO (encriptación real: DPAPI/keychain/keyring). Si el
 * SO no ofrece keyring (típico en Linux sin gnome-keyring/kwallet), caemos a un
 * fallback AES-256-GCM con una clave local guardada 0600 — así la sesión persiste en
 * todas las máquinas. El blob lleva un byte de método al inicio para saber cómo
 * descifrarlo. Todos los archivos se escriben 0600 (solo el usuario los lee).
 */

const FILE_NAME = 'session.bin'
const KEY_NAME = 'session.key'
const sessionFile = (): string => join(app.getPath('userData'), FILE_NAME)
const keyFile = (): string => join(app.getPath('userData'), KEY_NAME)

/**
 * Clave del fallback local: la lee de disco (0600) o la genera la primera vez.
 * Creación ATÓMICA (`wx`) para que dos guardados concurrentes no generen claves
 * distintas (evita huérfanos → re-login intermitente). Si la clave está pero con
 * tamaño inválido (corrupta / escritura parcial), la regeneramos limpio.
 */
async function localKey(): Promise<Buffer> {
  try {
    const existing = await readFile(keyFile())
    if (existing.length === LOCAL_KEY_BYTES) return existing
    await rm(keyFile(), { force: true }) // tamaño inválido: no sirve para descifrar nada, la rehacemos
  } catch (reason) {
    if ((reason as NodeJS.ErrnoException).code !== 'ENOENT') throw reason
  }

  const key = randomBytes(LOCAL_KEY_BYTES)
  try {
    const handle = await open(keyFile(), 'wx', 0o600) // exclusivo: gana una sola creación
    try {
      await handle.write(key)
    } finally {
      await handle.close()
    }
    return key
  } catch (reason) {
    if ((reason as NodeJS.ErrnoException).code === 'EEXIST') {
      const winner = await readFile(keyFile()) // otro proceso la creó primero: usamos la suya
      if (winner.length === LOCAL_KEY_BYTES) return winner
    }
    throw reason
  }
}

export async function saveRefreshToken(token: string): Promise<boolean> {
  try {
    const blob = safeStorage.isEncryptionAvailable()
      ? frame(TAG_SAFE_STORAGE, safeStorage.encryptString(token))
      : frame(TAG_LOCAL_AES, localEncrypt(token, await localKey()))
    await writeFile(sessionFile(), blob, { mode: 0o600 })
    await chmod(sessionFile(), 0o600) // el mode de writeFile se ignora si el archivo ya existía
    return true
  } catch (reason) {
    console.warn('[auth] no se pudo guardar la sesión:', reason instanceof Error ? reason.message : reason)
    return false
  }
}

export async function loadRefreshToken(): Promise<string | null> {
  try {
    const { tag, payload } = unframe(await readFile(sessionFile()))

    if (tag === TAG_SAFE_STORAGE) {
      if (!safeStorage.isEncryptionAvailable()) return null
      const token = safeStorage.decryptString(payload)
      return token.length > 0 ? token : null
    }
    if (tag === TAG_LOCAL_AES) {
      const token = localDecrypt(payload, await localKey())
      return token.length > 0 ? token : null
    }
    return null // formato desconocido
  } catch {
    // No hay sesión guardada, o ya no se puede descifrar (keyring cambió, clave perdida).
    return null
  }
}

export async function clearSession(): Promise<void> {
  await rm(sessionFile(), { force: true }).catch(() => undefined)
}
