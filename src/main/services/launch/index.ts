import { net } from 'electron'
import { createWriteStream, type WriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { Client } from 'minecraft-launcher-core'
import type { PlayResult, PlayState } from '../../../shared/play'
import { instanceDir, runtimeDir } from '../pack'
import { getConfig, resolvedManifestUrl } from '../config'
import { fetchManifest } from '../pack/manifest'
import { createSafeFetch, policyFromEnv } from '../pack/net'
import { downloadFile, type FetchLike } from '../pack/downloader'
import { mclcAuthorization } from '../auth'
import { detectJava, execJavaVersion, javaCandidates, MIN_JAVA } from './java'
import { ensureManagedJava } from './java-runtime'
import { realInstallJavaDeps } from './java-runtime-real'
import {
  installNeoforge,
  neoforgeJvmArgs,
  neoforgeVersionId,
  readNeoforgeVersionJson,
  resolveNeoforgeVersion
} from './neoforge'
import { runProcess } from './process'
import { runMclc, type MclcClient } from './minecraft'

/**
 * Pegamento M3: lanza el juego real. Compone piezas testeadas (java, neoforge,
 * mclc) con IO real (Electron net, MCLC, spawn). Emite fases de `PlayState`.
 */

type Emit = (state: PlayState) => void

const SHA1_HEX = /[0-9a-f]{40}/i

export async function runLaunch(emit: Emit, signal: AbortSignal): Promise<PlayResult> {
  let log: WriteStream | null = null
  try {
    const root = instanceDir()
    const safeFetch = createSafeFetch((input, init) => net.fetch(input, init), policyFromEnv(process.env))

    const url = await resolvedManifestUrl()
    if (url.length === 0) return fail('No hay modpack configurado. Pegá la URL del manifiesto en Settings.')
    const manifest = await fetchManifest(url, safeFetch, signal)

    // --- Java ---
    emit({ phase: 'preparing' })
    const requiredMajor = manifest.java?.major ?? MIN_JAVA
    let java = await detectJava(javaCandidates(process.env, process.platform), execJavaVersion, requiredMajor)
    if (!java) {
      // No hay Java del sistema: bajamos un JRE gestionado (una sola vez).
      emit({ phase: 'downloading-java', percent: 0 })
      const javaPath = await ensureManagedJava(
        requiredMajor,
        runtimeDir(),
        process.platform,
        (percent) => emit({ phase: 'downloading-java', percent }),
        realInstallJavaDeps,
        signal
      )
      java = { path: javaPath, major: requiredMajor }
    }

    // --- Sesión ---
    const authorization = await mclcAuthorization()
    if (!authorization) return fail('Iniciá sesión con Microsoft antes de jugar.')

    if (signal.aborted) return fail('Cancelado.')

    // --- NeoForge ---
    const nfVersion = await resolveNeoforgeVersion(manifest.loader.version, manifest.minecraft, (u) => fetchText(safeFetch, u))
    log = await openLog(root)
    emit({ phase: 'installing-loader' })
    await installNeoforge(root, nfVersion, {
      signal,
      onNote: (note) => log?.write(`[neoforge] ${note}\n`),
      download: (installerUrl, version) => downloadInstaller(safeFetch, installerUrl, version, root, signal),
      runInstaller: async (jar, r, sig) => {
        const result = await runProcess(java.path, ['-jar', jar, '--install-client', r], {
          cwd: r,
          signal: sig,
          onLine: (line) => log?.write(`[installer] ${line}\n`)
        })
        return { code: result.code }
      }
    })

    if (signal.aborted) return fail('Cancelado.')

    // --- Lanzar con MCLC ---
    emit({ phase: 'launching' })
    const cfg = await getConfig()

    // MCLC no pasa los args JVM de NeoForge (módulos JPMS). Los leemos del version
    // json y se los damos como customArgs, si no la JVM tira InaccessibleObjectException.
    const versionJson = await readNeoforgeVersionJson(root, nfVersion)
    const customArgs = neoforgeJvmArgs(versionJson, {
      libraryDir: join(root, 'libraries'),
      versionName: neoforgeVersionId(nfVersion),
      separator: process.platform === 'win32' ? ';' : ':'
    })

    const client = new Client() as unknown as MclcClient
    const options = {
      authorization,
      root,
      version: { number: manifest.minecraft, type: 'release', custom: neoforgeVersionId(nfVersion) },
      memory: { max: `${cfg.ramMaxMb}M`, min: `${cfg.ramMinMb}M` },
      javaPath: java.path,
      customArgs
    }

    const outcome = await runMclc(
      client,
      options,
      {
        onProgress: (loader) => emit({ phase: 'launching', loader }),
        onReady: () => emit({ phase: 'running' }),
        onData: (line) => log?.write(`${line}\n`),
        onDebug: (line) => log?.write(`[mclc] ${line}\n`)
      },
      signal
    )

    if (signal.aborted) return fail('Cancelado.')
    if (!outcome.ready && outcome.code !== 0) {
      return fail(`El juego se cerró con un error (código ${outcome.code}). Mirá logs/launch.log.`)
    }
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[launch] falló:', message)
    return { ok: false, error: message }
  } finally {
    log?.end()
  }
}

/* --------------------------------- helpers -------------------------------- */

function fail(error: string): PlayResult {
  return { ok: false, error }
}

async function fetchText(fetchFn: FetchLike, url: string): Promise<string> {
  const res = await fetchFn(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
  return res.text()
}

/** Baja el instalador de NeoForge verificando el sha1 del sidecar de maven. */
async function downloadInstaller(
  fetchFn: FetchLike,
  installerUrl: string,
  version: string,
  root: string,
  signal: AbortSignal
): Promise<string> {
  const sha1Text = await fetchText(fetchFn, `${installerUrl}.sha1`)
  const match = sha1Text.match(SHA1_HEX)
  if (!match) throw new Error('No se pudo verificar el instalador de NeoForge (sha1 ausente).')

  const dest = join(root, 'installers', `neoforge-${version}-installer.jar`)
  await downloadFile({ url: installerUrl, dest, sha1: match[0], fetchFn, signal, root })
  return dest
}

async function openLog(root: string): Promise<WriteStream> {
  const dir = join(root, 'logs')
  await mkdir(dir, { recursive: true })
  return createWriteStream(join(dir, 'launch.log'), { flags: 'w' })
}
