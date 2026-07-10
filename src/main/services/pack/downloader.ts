import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { lstat, mkdir, realpath, rename, rm } from 'node:fs/promises'
import { dirname, sep } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/**
 * Descarga verificada: stream a disco calculando sha1 al vuelo, escritura atómica
 * (`.part` + rename) y limpieza si algo falla. Nunca deja un archivo a medias.
 *
 * `fetchFn` se inyecta: en el main usamos `net.fetch` de Electron (respeta proxy),
 * en los tests el `fetch` global contra un server local.
 */

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; redirect?: 'follow' | 'error' | 'manual' }
) => Promise<Response>

/** Si el servidor deja de mandar bytes, cortamos. Evita descargas colgadas para siempre. */
const IDLE_TIMEOUT_MS = 20_000
/** Tolerancia sobre el `size` declarado antes de abortar (protege contra manifiestos mentirosos). */
const SIZE_SLACK = 1.05
/** Tope duro cuando el manifiesto NO declara `size`: sin esto, el CDN podría llenarte el disco. */
const MAX_UNKNOWN_FILE_BYTES = 1024 * 1024 * 1024 // 1 GB
const DEFAULT_ATTEMPTS = 3

export class DownloadError extends Error {
  readonly retryable: boolean
  constructor(message: string, retryable: boolean) {
    super(message)
    this.name = 'DownloadError'
    this.retryable = retryable
  }
}

export async function sha1OfFile(file: string): Promise<string | null> {
  try {
    const hash = createHash('sha1')
    await pipeline(createReadStream(file), hash)
    return hash.digest('hex')
  } catch {
    return null // no existe o no se puede leer: hay que bajarlo
  }
}

export interface DownloadOptions {
  url: string
  dest: string
  sha1: string
  size?: number
  fetchFn: FetchLike
  onBytes?: (delta: number) => void
  attempts?: number
  signal?: AbortSignal
  /** Raíz de la instancia. Si se pasa, se verifica que `dest` no escape (incluso vía symlink de directorio padre). */
  root?: string
}

/** Descarga `url` en `dest` verificando sha1. Reintenta lo que vale la pena reintentar. */
export async function downloadFile(options: DownloadOptions): Promise<void> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await downloadOnce(options)
      return
    } catch (error) {
      lastError = error
      const retryable = !(error instanceof DownloadError) || error.retryable
      if (!retryable || attempt === attempts || options.signal?.aborted) break
      await delay(250 * 2 ** (attempt - 1))
    }
  }
  throw lastError
}

async function downloadOnce(options: DownloadOptions): Promise<void> {
  const { url, dest, sha1, size, fetchFn, onBytes } = options
  await mkdir(dirname(dest), { recursive: true })
  await assertNotSymlink(dest)
  if (options.root) await assertParentWithinRoot(dest, options.root)

  const part = `${dest}.part`
  const controller = new AbortController()
  const abortOuter = (): void => controller.abort()
  options.signal?.addEventListener('abort', abortOuter, { once: true })

  let idleTimer: NodeJS.Timeout | undefined
  const resetIdle = (): void => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS)
  }

  try {
    resetIdle()
    const response = await fetchFn(url, { signal: controller.signal })
    if (!response.ok) {
      throw new DownloadError(`HTTP ${response.status} en ${url}`, isRetryableStatus(response.status))
    }
    if (!response.body) throw new DownloadError(`Respuesta sin cuerpo: ${url}`, true)

    const hash = createHash('sha1')
    let received = 0
    const limit = size !== undefined ? Math.ceil(size * SIZE_SLACK) : MAX_UNKNOWN_FILE_BYTES

    const meter = new Transform({
      transform(chunk: Buffer, _enc, callback) {
        received += chunk.length
        if (received > limit) {
          callback(new DownloadError(`El archivo excede el tamaño declarado (${size} bytes): ${url}`, false))
          return
        }
        hash.update(chunk)
        onBytes?.(chunk.length)
        resetIdle()
        callback(null, chunk)
      }
    })

    await pipeline(Readable.fromWeb(response.body as never), meter, createWriteStream(part))

    const actual = hash.digest('hex')
    if (actual.toLowerCase() !== sha1.toLowerCase()) {
      // Puede ser una transferencia corrupta: vale un reintento.
      throw new DownloadError(`sha1 no coincide en ${url} (esperado ${sha1}, obtenido ${actual})`, true)
    }
    if (size !== undefined && received !== size) {
      throw new DownloadError(`Tamaño inesperado en ${url} (esperado ${size}, obtenido ${received})`, true)
    }

    await rename(part, dest)
  } catch (error) {
    await rm(part, { force: true }).catch(() => undefined)
    throw error
  } finally {
    clearTimeout(idleTimer)
    options.signal?.removeEventListener('abort', abortOuter)
  }
}

/** Nos negamos a escribir a través de un symlink: podría apuntar fuera de la instancia. */
async function assertNotSymlink(dest: string): Promise<void> {
  try {
    const stats = await lstat(dest)
    if (stats.isSymbolicLink()) {
      console.warn(`[pack] destino es un symlink, se rechaza: ${dest}`)
      throw new DownloadError('El destino es un symlink.', false)
    }
  } catch (error) {
    if (error instanceof DownloadError) throw error
    // ENOENT: no existe todavía, que es lo normal.
  }
}

/**
 * Defensa en profundidad: aunque la ruta relativa sea segura, un DIRECTORIO PADRE
 * podría ser un symlink que apunta fuera de la instancia. Resolvemos el padre real
 * (ya existe tras el mkdir) y confirmamos que sigue dentro del root real.
 */
async function assertParentWithinRoot(dest: string, root: string): Promise<void> {
  const realParent = await realpath(dirname(dest))
  const realRoot = await realpath(root)
  if (realParent !== realRoot && !realParent.startsWith(realRoot + sep)) {
    console.warn(`[pack] destino fuera de la instancia: ${realParent}`)
    throw new DownloadError('El destino quedó fuera de la instancia.', false)
  }
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
