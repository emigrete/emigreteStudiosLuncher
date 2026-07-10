import { readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sha1OfFile } from './downloader'

/**
 * Verificar la instancia implica hashear cientos de MB de mods. Hacerlo en cada
 * arranque es carísimo, así que cacheamos el sha1 por (tamaño, mtime): si el
 * archivo no cambió, no lo volvemos a leer.
 *
 * El caché es una optimización, nunca una fuente de verdad: si algo no calza,
 * se re-hashea. Y las descargas SIEMPRE se verifican al vuelo.
 */

const CACHE_FILE = '.sync-cache.json'
const CACHE_VERSION = 1

interface CacheEntry {
  size: number
  mtimeMs: number
  sha1: string
}
interface CacheFile {
  version: number
  entries: Record<string, CacheEntry>
}

export interface FileHasher {
  /** sha1 del archivo, o null si no existe / no se puede leer. */
  hash(absPath: string, relPath: string): Promise<string | null>
  /** Persiste el caché (no-op en el hasher simple). */
  flush(): Promise<void>
}

/** Sin caché: siempre lee el archivo. Útil para tests y para forzar verificación. */
export const plainHasher: FileHasher = {
  hash: (absPath) => sha1OfFile(absPath),
  flush: async () => undefined
}

export async function createCachedHasher(root: string): Promise<FileHasher> {
  const cachePath = join(root, CACHE_FILE)
  const entries = await loadEntries(cachePath)
  let dirty = false

  return {
    async hash(absPath, relPath) {
      let stats: Awaited<ReturnType<typeof stat>>
      try {
        stats = await stat(absPath)
      } catch {
        if (entries[relPath]) {
          delete entries[relPath]
          dirty = true
        }
        return null
      }

      const cached = entries[relPath]
      if (cached && cached.size === stats.size && cached.mtimeMs === stats.mtimeMs) return cached.sha1

      const sha1 = await sha1OfFile(absPath)
      if (sha1) {
        entries[relPath] = { size: stats.size, mtimeMs: stats.mtimeMs, sha1 }
        dirty = true
      }
      return sha1
    },

    async flush() {
      if (!dirty) return
      const payload: CacheFile = { version: CACHE_VERSION, entries }
      await writeFile(cachePath, JSON.stringify(payload), 'utf8').catch(() => undefined)
      dirty = false
    }
  }
}

async function loadEntries(cachePath: string): Promise<Record<string, CacheEntry>> {
  try {
    const raw = JSON.parse(await readFile(cachePath, 'utf8')) as CacheFile
    if (raw.version !== CACHE_VERSION || typeof raw.entries !== 'object' || raw.entries === null) return {}
    return raw.entries
  } catch {
    return {} // sin caché o corrupto: se reconstruye solo
  }
}
