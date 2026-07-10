import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { SyncProgress } from '../src/shared/pack.ts'
import { syncPack } from '../src/main/services/pack/sync.ts'
import { plainHasher } from '../src/main/services/pack/hash-cache.ts'
import { exists, makeTempDir, removeDir, startServer } from './helpers/server.ts'

const sha1 = (data: string): string => createHash('sha1').update(data).digest('hex')

const CONTENT: Record<string, string> = {
  'mods/keep.jar': 'este ya lo tengo',
  'config/new.json': '{"corruption":true}'
}

/** Servidor que sirve el manifiesto y los archivos, con rutas especiales para los casos borde. */
async function startPackServer(extra?: { slow?: boolean }): Promise<{ url: string; close: () => Promise<void> }> {
  return startServer((req, res) => {
    const url = req.url ?? '/'

    if (url === '/slow') {
      res.writeHead(200)
      res.write('a')
      const timer = setInterval(() => res.write('a'), 30)
      res.on('close', () => clearInterval(timer))
      return
    }
    if (url.startsWith('/files/')) {
      const key = decodeURIComponent(url.slice('/files/'.length))
      const body = CONTENT[key]
      if (body === undefined) {
        res.writeHead(404).end()
        return
      }
      res.end(body)
      return
    }
    if (url.startsWith('/manifest')) {
      res.setHeader('content-type', 'application/json')
      res.end(res.req.headers['x-manifest'] as string)
      return
    }
    void extra
    res.writeHead(404).end()
  })
}

function manifestFor(base: string): unknown {
  return {
    packName: 'El Caballero de Netherite',
    packVersion: '0.1.0',
    minecraft: '1.21.1',
    loader: { type: 'neoforge', version: '21.1.0' },
    files: Object.entries(CONTENT).map(([path, body]) => ({
      path,
      url: `${base}/files/${path}`,
      sha1: sha1(body),
      size: Buffer.byteLength(body)
    })),
    external: [{ name: 'Bosses Rise', source: 'curseforge', targetPath: 'mods/bosses.jar' }]
  }
}

/** Sirve un manifiesto arbitrario por header (evita levantar un server por caso). */
function fetchWithManifest(manifest: unknown): (url: string, init?: { signal?: AbortSignal }) => Promise<Response> {
  return (url, init) =>
    fetch(url, {
      ...init,
      headers: url.includes('/manifest') ? { 'x-manifest': JSON.stringify(manifest) } : undefined
    })
}

test('sincroniza: saltea lo que ya está bien y baja lo que falta', async () => {
  const root = await makeTempDir()
  const server = await startPackServer()
  try {
    // Pre-creamos un archivo ya correcto: debe saltearse.
    const keep = join(root, 'mods', 'keep.jar')
    await mkdir(dirname(keep), { recursive: true })
    await writeFile(keep, CONTENT['mods/keep.jar'], 'utf8')

    const seen: SyncProgress[] = []
    const result = await syncPack({
      manifestUrl: `${server.url}/manifest.json`,
      root,
      fetchFn: fetchWithManifest(manifestFor(server.url)),
      hasher: plainHasher,
      onProgress: (p) => seen.push(p)
    })

    assert.deepEqual(result, { ok: true, downloaded: 1, skipped: 1, external: 1 })
    assert.equal(await readFile(join(root, 'config', 'new.json'), 'utf8'), CONTENT['config/new.json'])

    // El progreso pasa por las fases y termina completo.
    assert.equal(seen[0].phase, 'manifest')
    assert.ok(seen.some((p) => p.phase === 'checking'))
    assert.ok(seen.some((p) => p.phase === 'downloading'))

    const last = seen[seen.length - 1]
    assert.equal(last.phase, 'done')
    assert.equal(last.filesDone, last.filesTotal)
    assert.equal(last.bytesDone, last.bytesTotal)

    // bytesDone nunca retrocede.
    const downloading = seen.filter((p) => p.phase === 'downloading')
    for (let i = 1; i < downloading.length; i++) {
      assert.ok(downloading[i].bytesDone >= downloading[i - 1].bytesDone, 'bytesDone es monótono')
    }
  } finally {
    await server.close()
    await removeDir(root)
  }
})

test('re-sincronizar no vuelve a bajar nada', async () => {
  const root = await makeTempDir()
  const server = await startPackServer()
  try {
    const options = {
      manifestUrl: `${server.url}/manifest.json`,
      root,
      fetchFn: fetchWithManifest(manifestFor(server.url)),
      hasher: plainHasher,
      onProgress: () => undefined
    }
    const first = await syncPack(options)
    assert.deepEqual(first, { ok: true, downloaded: 2, skipped: 0, external: 1 })

    const second = await syncPack(options)
    assert.deepEqual(second, { ok: true, downloaded: 0, skipped: 2, external: 1 })
  } finally {
    await server.close()
    await removeDir(root)
  }
})

test('un manifiesto con path traversal se rechaza y no escribe fuera del root', async () => {
  const root = await makeTempDir()
  const outside = await makeTempDir()
  const server = await startPackServer()
  try {
    const evil = {
      ...(manifestFor(server.url) as Record<string, unknown>),
      files: [
        {
          path: '../../../../../../../../..' + join(outside, 'pwned.txt'),
          url: `${server.url}/files/mods/keep.jar`,
          sha1: sha1(CONTENT['mods/keep.jar'])
        }
      ]
    }
    const result = await syncPack({
      manifestUrl: `${server.url}/manifest.json`,
      root,
      fetchFn: fetchWithManifest(evil),
      hasher: plainHasher,
      onProgress: () => undefined
    })

    assert.equal(result.ok, false)
    assert.match((result as { error: string }).error, /insegura/)
    assert.equal(await exists(join(outside, 'pwned.txt')), false)
    assert.equal(await exists(resolve(root, 'pwned.txt')), false)
  } finally {
    await server.close()
    await removeDir(root)
    await removeDir(outside)
  }
})

test('un manifiesto con URL file:// se rechaza', async () => {
  const root = await makeTempDir()
  const server = await startPackServer()
  try {
    const evil = {
      ...(manifestFor(server.url) as Record<string, unknown>),
      files: [{ path: 'x.txt', url: 'file:///etc/passwd', sha1: sha1('x') }]
    }
    const result = await syncPack({
      manifestUrl: `${server.url}/manifest.json`,
      root,
      fetchFn: fetchWithManifest(evil),
      hasher: plainHasher,
      onProgress: () => undefined
    })
    assert.equal(result.ok, false)
    assert.match((result as { error: string }).error, /http\(s\)/)
  } finally {
    await server.close()
    await removeDir(root)
  }
})

test('cancelar corta la descarga y no deja archivos a medias', async () => {
  const root = await makeTempDir()
  const server = await startPackServer()
  try {
    const slow = {
      ...(manifestFor(server.url) as Record<string, unknown>),
      files: [{ path: 'mods/lento.jar', url: `${server.url}/slow`, sha1: sha1('nunca coincide') }]
    }
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 250)

    const result = await syncPack({
      manifestUrl: `${server.url}/manifest.json`,
      root,
      fetchFn: fetchWithManifest(slow),
      hasher: plainHasher,
      signal: controller.signal,
      onProgress: () => undefined
    })

    assert.equal(result.ok, false)
    assert.match((result as { error: string }).error, /cancelada/)
    assert.equal(await exists(join(root, 'mods', 'lento.jar')), false)
    assert.equal(await exists(join(root, 'mods', 'lento.jar.part')), false)
  } finally {
    await server.close()
    await removeDir(root)
  }
})

test('si un archivo falla, la sync entera falla (y no se cuelga)', async () => {
  const root = await makeTempDir()
  const server = await startPackServer()
  try {
    const broken = {
      ...(manifestFor(server.url) as Record<string, unknown>),
      files: [
        { path: 'a.txt', url: `${server.url}/files/mods/keep.jar`, sha1: sha1(CONTENT['mods/keep.jar']) },
        { path: 'b.txt', url: `${server.url}/files/no-existe`, sha1: sha1('x') }
      ]
    }
    const result = await syncPack({
      manifestUrl: `${server.url}/manifest.json`,
      root,
      fetchFn: fetchWithManifest(broken),
      hasher: plainHasher,
      onProgress: () => undefined
    })
    assert.equal(result.ok, false)
    assert.match((result as { error: string }).error, /HTTP 404/)
  } finally {
    await server.close()
    await removeDir(root)
  }
})
