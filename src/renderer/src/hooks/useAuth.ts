import { useCallback, useEffect, useState } from 'react'
import type { AuthProfile } from '@shared/types'

export type AuthStatus = 'loading' | 'guest' | 'authed'

export interface UseAuth {
  status: AuthStatus
  profile: AuthProfile | null
  /** Error a mostrar. Cancelar el login no genera error. */
  error: string | null
  /** true mientras la ventana de Microsoft está abierta o se cierra sesión. */
  busy: boolean
  login: () => Promise<void>
  logout: () => Promise<void>
}

/** Estado de autenticación del launcher. El trabajo real ocurre en el main. */
export function useAuth(): UseAuth {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Al montar: intenta restaurar la sesión guardada (login silencioso).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const state = await window.api.auth.state()
        if (cancelled) return
        if (state.status === 'authed') {
          setProfile(state.profile)
          setStatus('authed')
        } else {
          setStatus('guest')
        }
      } catch (reason) {
        console.error('[auth] no se pudo leer el estado:', reason)
        if (!cancelled) setStatus('guest')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.auth.login()
      if (result.ok) {
        setProfile(result.profile)
        setStatus('authed')
      } else if (!result.cancelled) {
        setError(result.error)
      }
    } catch (reason) {
      console.error('[auth] login falló:', reason)
      setError('No se pudo iniciar sesión. Intentá de nuevo.')
    } finally {
      setBusy(false)
    }
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.auth.logout()
    } catch (reason) {
      console.error('[auth] logout falló:', reason)
    } finally {
      setProfile(null)
      setError(null)
      setStatus('guest')
      setBusy(false)
    }
  }, [])

  return { status, profile, error, busy, login, logout }
}
