import { BrowserWindow } from 'electron'
import type { Auth } from 'msmc'

/**
 * Ventana de login de Microsoft, propia.
 *
 * No usamos `msmc.launch('electron')`: esa función importa el módulo de GUI en
 * runtime (y deja un console.log de depuración), y no nos deja controlar la
 * ventana. Acá usamos su API pública — `createLink()` para armar la URL de OAuth
 * y `login(code)` para canjear el código — con una ventana nuestra.
 *
 * La ventana usa una partición EN MEMORIA (sin prefijo `persist:`): las cookies
 * del login no ensucian la sesión de la app y desaparecen al cerrarla. Además,
 * al no ser la sesión por defecto, nunca recibe la CSP del launcher.
 */

const PARTITION = 'ms-login'
const WINDOW = { width: 520, height: 720 } as const

/** Chromium aborta la navegación cuando cerramos la ventana; no es un fallo real. */
const ERR_ABORTED = -3

export function requestAuthCode(authManager: Auth): Promise<string> {
  const redirect = authManager.token.redirect
  const url = authManager.createLink()

  const win = new BrowserWindow({
    width: WINDOW.width,
    height: WINDOW.height,
    resizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#141018',
    title: 'Iniciar sesión con Microsoft',
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.removeMenu()

  return new Promise<string>((resolve, reject) => {
    let settled = false

    const settle = (action: () => void): void => {
      if (settled) return
      settled = true
      action()
      if (!win.isDestroyed()) win.destroy()
    }

    /** Microsoft vuelve al `redirect` con `?code=...` o `?error=...`. */
    const inspect = (target: string): void => {
      if (!target.startsWith(redirect)) return
      const params = new URL(target).searchParams
      const code = params.get('code')
      if (code) {
        settle(() => resolve(code))
        return
      }
      // Cancelar desde la página de Microsoft llega como `access_denied`.
      const error = params.get('error')
      settle(() => reject(error === 'access_denied' ? 'error.gui.closed' : 'error.auth.microsoft'))
    }

    win.webContents.on('will-redirect', (details) => inspect(details.url))
    win.webContents.on('did-navigate', (_event, target) => inspect(target))
    win.webContents.on('did-fail-load', (_event, errorCode, description, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === ERR_ABORTED) return
      // La redirección final puede "fallar" (no hay página real detrás): la resuelve `inspect`.
      if (validatedURL.startsWith(redirect)) return
      settle(() => reject(`error.gui: ${errorCode} ${description}`))
    })

    // Cerrar la ventana a mano = cancelar.
    win.on('closed', () => {
      if (settled) return
      settled = true
      reject('error.gui.closed')
    })

    void win.loadURL(url)
  })
}
