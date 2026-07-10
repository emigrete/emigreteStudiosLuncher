/** Tipos compartidos entre main, preload y renderer (solo tipos, se borran al compilar). */

export interface AuthProfile {
  /** UUID sin guiones, tal como lo devuelve Mojang. */
  uuid: string
  name: string
  /** Cabeza del skin (8x8) como data URL, o null si no se pudo obtener. */
  avatar: string | null
  /** true si la cuenta no tiene Minecraft: Java Edition (modo demo). */
  demo: boolean
}

export type AuthState = { status: 'guest' } | { status: 'authed'; profile: AuthProfile }

export type AuthResult =
  | { ok: true; profile: AuthProfile }
  /** `cancelled` cuando el usuario cierra la ventana de Microsoft: no es un error a mostrar. */
  | { ok: false; cancelled: boolean; error: string }
