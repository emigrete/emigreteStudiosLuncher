import { resolve, sep } from 'node:path'

/**
 * Seguridad del manifiesto: las rutas vienen de la red y deciden DÓNDE escribimos.
 * Sin esto, un `path: "../../../.ssh/authorized_keys"` sobrescribe archivos del usuario.
 *
 * Reglas: relativa, separador `/`, sin `.` ni `..`, sin vacíos, sin absolutas
 * (posix o Windows), sin backslash y sin bytes nulos.
 */

const MAX_PATH_LENGTH = 1024
const WINDOWS_DRIVE = /^[a-zA-Z]:/

export function isSafeRelativePath(value: string): boolean {
  if (typeof value !== 'string') return false
  if (value.length === 0 || value.length > MAX_PATH_LENGTH) return false
  if (value.includes('\0')) return false
  if (value.includes('\\')) return false // el manifiesto usa '/' siempre
  if (value.startsWith('/')) return false // absoluta posix
  if (WINDOWS_DRIVE.test(value)) return false // C:/...
  return value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
}

export class UnsafePathError extends Error {
  constructor(value: string) {
    super(`Ruta insegura en el manifiesto: ${JSON.stringify(value)}`)
    this.name = 'UnsafePathError'
  }
}

/** Resuelve `relative` dentro de `root`. Lanza `UnsafePathError` si intenta escapar. */
export function safeResolve(root: string, relative: string): string {
  if (!isSafeRelativePath(relative)) throw new UnsafePathError(relative)

  const rootAbs = resolve(root)
  const target = resolve(rootAbs, relative)
  // Defensa en profundidad: aunque isSafeRelativePath ya lo impide, verificamos el resultado.
  if (target !== rootAbs && !target.startsWith(rootAbs + sep)) throw new UnsafePathError(relative)
  return target
}
