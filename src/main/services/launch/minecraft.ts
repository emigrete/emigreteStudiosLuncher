import type { LoaderProgress } from '../../../shared/play'

/**
 * Wrapper sobre MCLC (`minecraft-launcher-core`). MCLC no expone un evento
 * "ventana abierta", así que lo inferimos de la salida del juego. Todo el cliente
 * se inyecta para poder testear la lógica sin lanzar Minecraft de verdad.
 */

/** Interfaz mínima de MCLC que usamos (Client extiende EventEmitter). */
export interface MclcClient {
  on(event: string, listener: (...args: unknown[]) => void): unknown
  launch(options: unknown): Promise<{ kill: () => void } | null>
}

/** Marcadores de que el juego ya arrancó su ventana / render (no un crash temprano). */
const READY_MARKERS = [
  /Backend library: LWJGL/i,
  /LWJGL Version/i,
  /OpenAL initialized/i,
  /Sound engine started/i,
  /Setting user:/i,
  /\[Render thread\/INFO\].*Created:/i
]

export function isReadyLine(line: string): boolean {
  return READY_MARKERS.some((re) => re.test(line))
}

/** Normaliza el payload del evento `progress` de MCLC a nuestro LoaderProgress. */
export function toLoaderProgress(raw: unknown): LoaderProgress | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as { type?: unknown; task?: unknown; total?: unknown }
  if (typeof p.task !== 'number' || typeof p.total !== 'number') return null
  return { type: typeof p.type === 'string' ? p.type : 'descarga', task: p.task, total: p.total }
}

export interface LaunchHooks {
  onProgress?: (progress: LoaderProgress) => void
  onData?: (line: string) => void
  onReady?: () => void
  onDebug?: (line: string) => void
}

export interface LaunchOutcome {
  /** Código de salida del juego (0 = limpio, != 0 = crash). null si se mató. */
  code: number | null
  /** true si el juego llegó a abrir la ventana antes de cerrarse. */
  ready: boolean
}

/**
 * Lanza el juego y resuelve cuando el proceso termina.
 * `onReady` se dispara la primera vez que detectamos que la ventana abrió.
 */
export async function runMclc(
  client: MclcClient,
  options: unknown,
  hooks: LaunchHooks = {},
  signal?: AbortSignal
): Promise<LaunchOutcome> {
  return new Promise<LaunchOutcome>((resolve, reject) => {
    let ready = false
    let settled = false
    let child: { kill: () => void } | null = null

    const markReady = (line: string): void => {
      if (!ready && isReadyLine(line)) {
        ready = true
        hooks.onReady?.()
      }
    }

    client.on('progress', (raw) => {
      const p = toLoaderProgress(raw)
      if (p) hooks.onProgress?.(p)
    })
    client.on('data', (line) => {
      const text = String(line)
      hooks.onData?.(text)
      markReady(text)
    })
    client.on('debug', (line) => hooks.onDebug?.(String(line)))
    client.on('close', (code) => {
      if (settled) return
      settled = true
      resolve({ code: typeof code === 'number' ? code : null, ready })
    })

    const onAbort = (): void => child?.kill()
    signal?.addEventListener('abort', onAbort, { once: true })

    client
      .launch(options)
      .then((proc) => {
        if (!proc) {
          if (!settled) {
            settled = true
            reject(new Error('MCLC no pudo lanzar el juego.'))
          }
          return
        }
        child = proc
        if (signal?.aborted) proc.kill()
      })
      .catch((error) => {
        if (!settled) {
          settled = true
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      })
  })
}
