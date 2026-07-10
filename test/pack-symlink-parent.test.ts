import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { downloadFile } from '../src/main/services/pack/downloader.ts'
import { exists, makeTempDir, removeDir, startServer } from './helpers/server.ts'

const sha1 = (data: string): string => createHash('sha1').update(data).digest('hex')

/**
 * Ataque: un DIRECTORIO PADRE es un symlink que apunta fuera de la instancia.
 * `safeResolve` valida el string de la ruta (no hay `..`), y el destino final no
 * es un symlink — pero al escribir se sigue el symlink del padre y el archivo
 * termina fuera del root. Este test documenta el comportamiento real.
 */
test('escribir bajo un directorio padre symlinkeado NO debe escapar del root', async () => {
  const root = await makeTempDir()
  const outside = await makeTempDir()
  const server = await startServer((_req, res) => res.end('payload'))
  try {
    // root/mods -> /outside  (symlink de directorio)
    await symlink(outside, join(root, 'mods'), 'dir')

    const dest = join(root, 'mods', 'evil.jar') // resuelve a outside/evil.jar al seguir el symlink
    let threw = false
    try {
      await downloadFile({ url: `${server.url}/x`, dest, sha1: sha1('payload'), fetchFn: fetch, attempts: 1, root })
    } catch {
      threw = true
    }

    const escaped = await exists(join(outside, 'evil.jar'))
    assert.equal(threw, true, 'debe rechazar el destino symlinkeado')
    assert.equal(escaped, false, 'no debe escribir fuera del root vía symlink de directorio padre')
  } finally {
    await server.close()
    await removeDir(root)
    await removeDir(outside)
  }
})
