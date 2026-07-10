import { app, net } from 'electron'
import { join } from 'node:path'
import type { SyncProgress, SyncResult } from '../../../shared/pack'
import { syncPack } from './sync'
import { createSafeFetch, policyFromEnv } from './net'
import { resolvedManifestUrl } from '../config'

/**
 * Puente entre la sincronización (Node puro) y Electron.
 * Solo puede haber una sync en curso; se puede cancelar.
 */

export function instanceDir(): string {
  return join(app.getPath('userData'), 'instance')
}

/** Raíz del JRE gestionado (hermano de la instancia): userData/runtime. */
export function runtimeDir(): string {
  return join(app.getPath('userData'), 'runtime')
}


let inFlight: Promise<SyncResult> | null = null
let controller: AbortController | null = null

export function isSyncing(): boolean {
  return inFlight !== null
}

export function cancelSync(): void {
  controller?.abort()
}

export async function runSync(onProgress: (progress: SyncProgress) => void): Promise<SyncResult> {
  if (inFlight) return { ok: false, error: 'Ya hay una sincronización en curso.' }

  const url = await resolvedManifestUrl()
  if (url.length === 0) {
    return {
      ok: false,
      error: 'No hay modpack configurado. Pegá la URL del manifiesto en Settings.'
    }
  }

  // net.fetch respeta el proxy del SO; createSafeFetch le suma defensa SSRF:
  // https obligatorio, sin hosts privados, redirects revalidados salto a salto.
  const safeFetch = createSafeFetch((input, init) => net.fetch(input, init), policyFromEnv(process.env))

  controller = new AbortController()
  inFlight = syncPack({
    manifestUrl: url,
    root: instanceDir(),
    fetchFn: safeFetch,
    onProgress,
    signal: controller.signal
  }).finally(() => {
    inFlight = null
    controller = null
  })

  return inFlight
}
