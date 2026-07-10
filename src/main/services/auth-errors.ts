/**
 * Traducción de los códigos de error de msmc a mensajes para el usuario.
 * Función pura (sin Electron ni IO) para poder testearla.
 */

export interface FriendlyAuthError {
  /** true cuando el usuario cerró la ventana de Microsoft: no hay que mostrar error. */
  cancelled: boolean
  message: string
}

/** Extrae un código legible de lo que sea que haya lanzado msmc. */
export function toErrorCode(reason: unknown): string {
  if (typeof reason === 'string') return reason
  if (reason instanceof Error) return reason.message
  if (reason && typeof reason === 'object') {
    const maybe = reason as { reason?: unknown; message?: unknown }
    if (typeof maybe.reason === 'string') return maybe.reason
    if (typeof maybe.message === 'string') return maybe.message
  }
  return 'error.auth'
}

const MESSAGES: ReadonlyArray<readonly [string, string]> = [
  ['error.gui.closed', 'Cancelaste el inicio de sesión.'],
  ['error.auth.minecraft.profile', 'Esa cuenta no tiene Minecraft: Java Edition.'],
  ['error.auth.minecraft.entitlements', 'Esa cuenta no tiene Minecraft: Java Edition.'],
  ['error.auth.minecraft.login', 'Microsoft aceptó el login, pero Minecraft lo rechazó.'],
  ['error.auth.minecraft', 'No se pudo verificar tu cuenta de Minecraft.'],
  ['error.auth.xsts.bannedCountry', 'Xbox Live no está disponible en tu país.'],
  ['error.auth.xsts.child.SK', 'La cuenta es de un menor: necesita una familia de Xbox.'],
  ['error.auth.xsts.child', 'La cuenta es de un menor: necesita una familia de Xbox.'],
  ['error.auth.xsts.userNotFound', 'Esa cuenta de Microsoft no tiene perfil de Xbox Live.'],
  ['error.auth.xsts', 'Xbox Live rechazó el inicio de sesión.'],
  ['error.auth.xboxLive', 'No se pudo iniciar sesión en Xbox Live.'],
  ['error.auth.microsoft', 'Microsoft rechazó el inicio de sesión.'],
  ['error.state.invalid', 'La ventana de inicio de sesión devolvió una respuesta inválida.'],
  ['error.gui', 'No se pudo abrir la ventana de inicio de sesión.'],
  ['error.auth', 'No se pudo iniciar sesión. Intentá de nuevo.']
]

const FALLBACK = 'No se pudo iniciar sesión. Intentá de nuevo.'

/**
 * Mapea el código al mensaje más específico que aplique.
 * El orden de MESSAGES va de específico a general (`error.auth.xsts.child.SK`
 * antes que `error.auth.xsts`), y elegimos el primer prefijo que coincida.
 */
export function friendlyAuthError(reason: unknown): FriendlyAuthError {
  const code = toErrorCode(reason)
  const cancelled = code.startsWith('error.gui.closed')
  const hit = MESSAGES.find(([prefix]) => code.startsWith(prefix))
  return { cancelled, message: hit ? hit[1] : FALLBACK }
}
