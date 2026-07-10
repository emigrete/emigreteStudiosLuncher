import type { PackFile, PackManifest, SyncProgress, SyncResult } from '../../../shared/pack'
import { downloadFile, type FetchLike } from './downloader'
import { createCachedHasher, type FileHasher } from './hash-cache'
import { fetchManifest } from './manifest'
import { safeResolve } from './paths'

/**
 * Sincronización del modpack: manifiesto -> qué falta -> descargar y verificar.
 * Sin dependencias de Electron para poder testearlo end-to-end contra un server local.
 */

// Hash y descarga son cargas distintas: hashear en paralelo THRASHEA un HDD
// (seeks), así que va de a 1; descargar en paralelo esconde la latencia de red.
const HASH_CONCURRENCY = 1
const DOWNLOAD_CONCURRENCY = 4
const PROGRESS_INTERVAL_MS = 120

export interface SyncOptions {
  manifestUrl: string
  /** Raíz de la instancia. Todas las rutas del manifiesto se resuelven adentro. */
  root: string
  fetchFn: FetchLike
  onProgress: (progress: SyncProgress) => void
  /** Concurrencia al verificar hashes locales (default 1: amable con HDD). */
  hashConcurrency?: number
  /** Concurrencia al descargar (default 4). */
  downloadConcurrency?: number
  hasher?: FileHasher
  signal?: AbortSignal
}

export interface PlannedDownload {
  file: PackFile
  dest: string
}

export interface SyncPlan {
  toDownload: PlannedDownload[]
  skipped: number
  /** 0 si ningún archivo a bajar declara `size`. */
  bytesTotal: number
}

/** Decide qué hay que bajar. Un archivo se baja si falta o si su sha1 no coincide. */
export async function planSync(
  manifest: PackManifest,
  root: string,
  hasher: FileHasher,
  onChecked?: (relPath: string) => void,
  concurrency = HASH_CONCURRENCY
): Promise<SyncPlan> {
  const results = new Array<PlannedDownload | null>(manifest.files.length)

  await runPool(manifest.files, concurrency, async (file, index) => {
    const dest = safeResolve(root, file.path) // lanza si el manifiesto intenta escapar
    const current = await hasher.hash(dest, file.path)
    const upToDate = current !== null && current.toLowerCase() === file.sha1.toLowerCase()
    results[index] = upToDate ? null : { file, dest }
    onChecked?.(file.path)
  })

  const toDownload = results.filter((entry): entry is PlannedDownload => entry !== null)
  return {
    toDownload,
    skipped: manifest.files.length - toDownload.length,
    bytesTotal: toDownload.reduce((total, entry) => total + (entry.file.size ?? 0), 0)
  }
}

export async function syncPack(options: SyncOptions): Promise<SyncResult> {
  const hashConcurrency = options.hashConcurrency ?? HASH_CONCURRENCY
  const downloadConcurrency = options.downloadConcurrency ?? DOWNLOAD_CONCURRENCY
  const controller = new AbortController()
  const abortOuter = (): void => controller.abort()
  options.signal?.addEventListener('abort', abortOuter, { once: true })

  const progress: SyncProgress = {
    phase: 'manifest',
    filesDone: 0,
    filesTotal: 0,
    bytesDone: 0,
    bytesTotal: 0,
    currentFile: null
  }
  const emit = createThrottledEmitter(options.onProgress)

  try {
    emit(progress, true)
    const manifest = await fetchManifest(options.manifestUrl, options.fetchFn, controller.signal)

    const hasher = options.hasher ?? (await createCachedHasher(options.root))

    progress.phase = 'checking'
    progress.filesTotal = manifest.files.length
    emit(progress, true)

    const plan = await planSync(
      manifest,
      options.root,
      hasher,
      () => {
        progress.filesDone += 1
        emit(progress)
      },
      hashConcurrency
    )

    progress.phase = 'downloading'
    progress.filesDone = plan.skipped
    progress.bytesTotal = plan.bytesTotal
    progress.bytesDone = 0
    progress.currentFile = plan.toDownload[0]?.file.path ?? null
    emit(progress, true)

    await runPool(plan.toDownload, downloadConcurrency, async ({ file, dest }) => {
      progress.currentFile = file.path
      await downloadFile({
        url: file.url,
        dest,
        sha1: file.sha1,
        size: file.size,
        fetchFn: options.fetchFn,
        signal: controller.signal,
        root: options.root,
        onBytes: (delta) => {
          progress.bytesDone += delta
          emit(progress)
        }
      })
      progress.filesDone += 1
      emit(progress, true)
    }, controller)

    await hasher.flush()

    progress.phase = 'done'
    progress.currentFile = null
    progress.filesDone = manifest.files.length
    if (progress.bytesTotal > 0) progress.bytesDone = progress.bytesTotal
    emit(progress, true)

    return {
      ok: true,
      downloaded: plan.toDownload.length,
      skipped: plan.skipped,
      external: manifest.external.length
    }
  } catch (error) {
    // `options.signal` solo lo aborta el usuario; el controller interno también se
    // aborta ante un fallo, así que no sirve para distinguir cancelación.
    const cancelled = options.signal?.aborted === true
    controller.abort()
    const message = cancelled
      ? 'Sincronización cancelada.'
      : error instanceof Error
        ? error.message
        : String(error)
    progress.phase = 'error'
    progress.message = message
    emit(progress, true)
    return { ok: false, error: message }
  } finally {
    options.signal?.removeEventListener('abort', abortOuter)
  }
}

/* --------------------------------- Helpers -------------------------------- */

/**
 * Pool con concurrencia acotada. Al primer error aborta el resto (si le pasan un
 * controller) y propaga ese error.
 */
async function runPool<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
  controller?: AbortController
): Promise<void> {
  let cursor = 0
  let failure: unknown = null

  const runner = async (): Promise<void> => {
    while (cursor < items.length && failure === null) {
      const index = cursor++
      try {
        await worker(items[index], index)
      } catch (error) {
        failure ??= error
        controller?.abort()
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner))
  if (failure !== null) throw failure
}

/** Evita inundar el IPC: emite como mucho cada PROGRESS_INTERVAL_MS, salvo hitos. */
function createThrottledEmitter(
  onProgress: (progress: SyncProgress) => void
): (progress: SyncProgress, force?: boolean) => void {
  let lastEmit = 0
  return (progress, force = false) => {
    const now = Date.now()
    if (!force && now - lastEmit < PROGRESS_INTERVAL_MS) return
    lastEmit = now
    onProgress({ ...progress }) // copia: el objeto muta mientras avanza la sync
  }
}
