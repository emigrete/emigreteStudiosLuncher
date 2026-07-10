import { app } from 'electron'
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import type { LauncherConfig } from '../../shared/config'
import { DEFAULT_CONFIG, sanitizeConfig } from '../../shared/config'

/**
 * Config persistida del launcher (`userData/launcher-config.json`).
 * La URL del manifiesto y la RAM viven acá para que el usuario no dependa de
 * variables de entorno. Las env vars siguen ganando (útil para desarrollo).
 */

const configFile = (): string => join(app.getPath('userData'), 'launcher-config.json')

let cache: LauncherConfig | null = null

export async function getConfig(): Promise<LauncherConfig> {
  if (cache) return cache
  try {
    const raw = JSON.parse(await readFile(configFile(), 'utf8'))
    cache = sanitizeConfig(raw)
  } catch {
    cache = { ...DEFAULT_CONFIG }
  }
  return cache
}

export async function setConfig(patch: Partial<LauncherConfig>): Promise<LauncherConfig> {
  const next = sanitizeConfig({ ...(await getConfig()), ...patch })
  cache = next
  await writeFile(configFile(), `${JSON.stringify(next, null, 2)}\n`, 'utf8').catch((error) => {
    console.error('[config] no se pudo guardar:', error)
  })
  return next
}

/** URL del manifiesto a usar: env override -> config. `''` si no hay ninguna. */
export async function resolvedManifestUrl(): Promise<string> {
  const fromEnv = process.env.PACK_MANIFEST_URL
  if (fromEnv && fromEnv.length > 0) return fromEnv
  return (await getConfig()).manifestUrl
}
