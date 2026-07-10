import { Auth } from 'msmc'
import type { Minecraft, Xbox } from 'msmc'
import type { AuthProfile, AuthResult, AuthState } from '../../shared/types'
import { friendlyAuthError, toErrorCode } from './auth-errors'
import { clearAvatarCache, playerHeadDataUrl } from './avatar'
import { requestAuthCode } from './login-window'
import { clearSession, loadRefreshToken, saveRefreshToken } from './session-store'

/**
 * Autenticación con Microsoft (msmc). Vive SOLO en el proceso main.
 *
 * La ventana de OAuth la abrimos nosotros (ver `login-window.ts`) usando la API
 * pública de msmc: `createLink()` + `login(code)`.
 *
 * Client ID: msmc trae el del launcher oficial, así que funciona sin registrar
 * nada en Azure. Para usar una app propia, definí MSMC_CLIENT_ID y MSMC_REDIRECT.
 */

type MCProfile = NonNullable<Minecraft['profile']>

const PROMPT = 'select_account'

/** Sesión viva en memoria. `xbox` permite refrescar el token de Minecraft. */
let xbox: Xbox | null = null
let mc: Minecraft | null = null

/** Evita reintentar la restauración en cada consulta si ya sabemos que no hay sesión. */
let restoreAttempted = false
let restoreInFlight: Promise<Minecraft | null> | null = null

function createAuth(): Auth {
  const clientId = process.env.MSMC_CLIENT_ID
  const redirect = process.env.MSMC_REDIRECT
  if (clientId && redirect) return new Auth({ client_id: clientId, redirect, prompt: PROMPT })
  return new Auth(PROMPT)
}

/* ------------------------------- API pública ------------------------------ */

export async function getAuthState(): Promise<AuthState> {
  const session = await currentSession()
  return session ? { status: 'authed', profile: await toProfile(session) } : { status: 'guest' }
}

export async function login(): Promise<AuthResult> {
  try {
    const authManager = createAuth()
    // Ventana propia: msmc.launch('electron') no nos deja controlarla.
    const code = await requestAuthCode(authManager)
    const session = await adopt(await authManager.login(code))
    return { ok: true, profile: await toProfile(session) }
  } catch (reason) {
    const { cancelled, message } = friendlyAuthError(reason)
    if (!cancelled) console.error('[auth] login falló:', toErrorCode(reason))
    return { ok: false, cancelled, error: message }
  }
}

export async function logout(): Promise<void> {
  xbox = null
  mc = null
  restoreAttempted = true // logout explícito: no volver a restaurar solo
  clearAvatarCache()
  await clearSession()
}

/* --------------------------------- Interno -------------------------------- */

async function adopt(next: Xbox): Promise<Minecraft> {
  const session = await next.getMinecraft()
  if (!session.profile) throw new Error('error.auth.minecraft.profile')
  xbox = next
  mc = session
  restoreAttempted = true
  await saveRefreshToken(next.save())
  return session
}

/** Devuelve una sesión válida: la de memoria, una refrescada, o la persistida. */
async function currentSession(): Promise<Minecraft | null> {
  if (mc?.validate()) return mc

  if (xbox) {
    try {
      await xbox.refresh()
      return await adopt(xbox)
    } catch (reason) {
      console.warn('[auth] no se pudo refrescar la sesión:', toErrorCode(reason))
      xbox = null
      mc = null
      await clearSession()
    }
  }

  if (restoreAttempted) return null
  restoreInFlight ??= restoreFromDisk()
  const restored = await restoreInFlight
  restoreInFlight = null
  return restored
}

/** Login silencioso con el refresh token guardado. Nunca lanza. */
async function restoreFromDisk(): Promise<Minecraft | null> {
  restoreAttempted = true
  const token = await loadRefreshToken()
  if (!token) return null

  try {
    return await adopt(await createAuth().refresh(token))
  } catch (reason) {
    console.warn('[auth] sesión guardada inválida:', toErrorCode(reason))
    xbox = null
    mc = null
    await clearSession()
    return null
  }
}

async function toProfile(session: Minecraft): Promise<AuthProfile> {
  const profile = session.profile as MCProfile
  const skinUrl = profile.skins?.find((s) => s.state === 'ACTIVE')?.url ?? profile.skins?.[0]?.url
  return {
    uuid: profile.id,
    name: profile.name,
    avatar: await playerHeadDataUrl(profile.id, skinUrl),
    demo: session.isDemo()
  }
}

/**
 * Autorización para MCLC (M3). Asegura una sesión válida (refresca si hace falta)
 * y devuelve el objeto que MCLC espera en `authorization`, o null si no hay sesión.
 * El token de Minecraft dura ~24h; por eso refrescamos antes de cada lanzamiento.
 */
export async function mclcAuthorization(): Promise<Record<string, unknown> | null> {
  const session = await currentSession()
  return session ? (session.mclc(true) as unknown as Record<string, unknown>) : null
}
