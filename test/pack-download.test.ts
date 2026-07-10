import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { downloadFile, sha1OfFile } from '../src/main/services/pack/downloader.ts'
import { exists, makeTempDir, removeDir, startServer } from './helpers/server.ts'

const sha1 = (data: string): string => createHash('sha1').update(data).digest('hex')
const BODY = 'contenido del mod'

test('descarga, verifica el sha1 y deja el archivo (sin .part)', async () => {
  const dir = await makeTempDir()
  const server = await startServer((_req, res) => res.end(BODY))
  try {
    const dest = join(dir, 'mods', 'mod.jar')
    let bytes = 0
    await downloadFile({
      url: `${server.url}/mod.jar`,
      dest,
      sha1: sha1(BODY),
      fetchFn: fetch,
      onBytes: (delta) => (bytes += delta)
    })
    assert.equal(await readFile(dest, 'utf8'), BODY)
    assert.equal(bytes, Buffer.byteLength(BODY))
    assert.equal(await exists(`${dest}.part`), false)
  } finally {
    await server.close()
    await removeDir(dir)
  }
})

test('un 404 no se reintenta y no deja basura', async () => {
  const dir = await makeTempDir()
  let hits = 0
  const server = await startServer((_req, res) => {
    hits++
    res.writeHead(404).end('nope')
  })
  try {
    const dest = join(dir, 'mod.jar')
    await assert.rejects(
      () => downloadFile({ url: `${server.url}/x`, dest, sha1: sha1(BODY), fetchFn: fetch, attempts: 3 }),
      /HTTP 404/
    )
    assert.equal(hits, 1, 'un 4xx no debe reintentarse')
    assert.equal(await exists(dest), false)
    assert.equal(await exists(`${dest}.part`), false)
  } finally {
    await server.close()
    await removeDir(dir)
  }
})

test('un 500 sí se reintenta y termina bien', async () => {
  const dir = await makeTempDir()
  let hits = 0
  const server = await startServer((_req, res) => {
    hits++
    if (hits === 1) res.writeHead(500).end('boom')
    else res.end(BODY)
  })
  try {
    const dest = join(dir, 'mod.jar')
    await downloadFile({ url: `${server.url}/x`, dest, sha1: sha1(BODY), fetchFn: fetch, attempts: 3 })
    assert.equal(hits, 2)
    assert.equal(await readFile(dest, 'utf8'), BODY)
  } finally {
    await server.close()
    await removeDir(dir)
  }
})

test('sha1 que no coincide: reintenta, falla y NO escribe el archivo', async () => {
  const dir = await makeTempDir()
  let hits = 0
  const server = await startServer((_req, res) => {
    hits++
    res.end('contenido corrupto')
  })
  try {
    const dest = join(dir, 'mod.jar')
    await assert.rejects(
      () => downloadFile({ url: `${server.url}/x`, dest, sha1: sha1(BODY), fetchFn: fetch, attempts: 2 }),
      /sha1 no coincide/
    )
    assert.equal(hits, 2, 'una transferencia corrupta merece un reintento')
    assert.equal(await exists(dest), false)
    assert.equal(await exists(`${dest}.part`), false)
  } finally {
    await server.close()
    await removeDir(dir)
  }
})

test('aborta si el cuerpo excede el size declarado (manifiesto mentiroso)', async () => {
  const dir = await makeTempDir()
  let hits = 0
  const server = await startServer((_req, res) => {
    hits++
    res.end('x'.repeat(5000))
  })
  try {
    const dest = join(dir, 'mod.jar')
    await assert.rejects(
      () => downloadFile({ url: `${server.url}/x`, dest, sha1: sha1(BODY), size: 10, fetchFn: fetch, attempts: 3 }),
      /excede el tamaño declarado/
    )
    assert.equal(hits, 1, 'no tiene sentido reintentar un manifiesto mentiroso')
    assert.equal(await exists(dest), false)
  } finally {
    await server.close()
    await removeDir(dir)
  }
})

test('rechaza escribir a través de un symlink', async () => {
  const dir = await makeTempDir()
  const outside = await makeTempDir()
  const server = await startServer((_req, res) => res.end(BODY))
  try {
    const victim = join(outside, 'victima.txt')
    await writeFile(victim, 'original', 'utf8')
    const dest = join(dir, 'mod.jar')
    await symlink(victim, dest)

    await assert.rejects(
      () => downloadFile({ url: `${server.url}/x`, dest, sha1: sha1(BODY), fetchFn: fetch, attempts: 1 }),
      /symlink/
    )
    assert.equal(await readFile(victim, 'utf8'), 'original', 'no debe tocarse el archivo apuntado')
  } finally {
    await server.close()
    await removeDir(dir)
    await removeDir(outside)
  }
})

test('sha1OfFile devuelve null si el archivo no existe', async () => {
  assert.equal(await sha1OfFile('/no/existe/nada.jar'), null)
})

test('sha1OfFile calcula el hash real', async () => {
  const dir = await makeTempDir()
  try {
    const file = join(dir, 'a.txt')
    await writeFile(file, BODY, 'utf8')
    assert.equal(await sha1OfFile(file), sha1(BODY))
  } finally {
    await removeDir(dir)
  }
})
