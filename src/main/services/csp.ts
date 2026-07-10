/**
 * Content-Security-Policy del launcher. Funciones puras (sin Electron) para testear.
 *
 * IMPORTANTE: la CSP es para NUESTRA interfaz. Si se inyecta en respuestas de terceros
 * (por ejemplo el login de Microsoft, que vive en login.live.com), `default-src 'self'`
 * bloquea sus scripts y estilos y la página queda en blanco.
 */

/** `img/font: data:` = assets que Vite inlinea en el bundle propio. */
const PROD_CSP =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; " +
  "font-src 'self' data:; " +
  "connect-src 'self'; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "form-action 'none'"

/** En dev hay que permitir el HMR de Vite (websocket + eval). */
const DEV_CSP =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; " +
  "font-src 'self' data:; " +
  "connect-src 'self' ws://localhost:* http://localhost:*; " +
  "object-src 'none'; " +
  "base-uri 'self'"

export function buildCsp(isDev: boolean): string {
  return isDev ? DEV_CSP : PROD_CSP
}

/**
 * ¿La respuesta pertenece a la UI del launcher?
 * En producción el renderer se sirve por `file://`; en dev, desde el server de Vite.
 */
export function isAppUrl(url: string, devRendererUrl?: string): boolean {
  if (url.startsWith('file://')) return true
  if (devRendererUrl && devRendererUrl.length > 0 && url.startsWith(devRendererUrl)) return true
  return false
}
