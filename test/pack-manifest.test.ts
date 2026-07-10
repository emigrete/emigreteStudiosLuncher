import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ManifestError, fetchManifest, parseManifest } from '../src/main/services/pack/manifest.ts'

const SHA1 = 'a'.repeat(40)

const valid = {
  packName: 'El Caballero de Netherite',
  packVersion: '0.1.0',
  minecraft: '1.21.1',
  loader: { type: 'neoforge', version: '21.1.0' },
  java: { major: 21 },
  files: [{ path: 'mods/mod.jar', url: 'https://cdn.test/mods/mod.jar', sha1: SHA1, size: 123 }]
}

test('acepta el manifiesto del spec y aplica default a external', () => {
  const manifest = parseManifest(valid)
  assert.equal(manifest.packName, 'El Caballero de Netherite')
  assert.deepEqual(manifest.external, [])
  assert.equal(manifest.files[0].size, 123)
})

test('size es opcional', () => {
  const manifest = parseManifest({ ...valid, files: [{ path: 'a.txt', url: 'https://c/a', sha1: SHA1 }] })
  assert.equal(manifest.files[0].size, undefined)
})

test('rechaza rutas con path traversal', () => {
  const bad = { ...valid, files: [{ path: '../../.ssh/authorized_keys', url: 'https://c/x', sha1: SHA1 }] }
  assert.throws(() => parseManifest(bad), /ruta relativa insegura/)
})

test('rechaza URLs que no son http(s) — nada de file:// ni data:', () => {
  for (const url of ['file:///etc/passwd', 'data:text/plain,hola', 'ftp://x/y', 'javascript:alert(1)']) {
    assert.throws(() => parseManifest({ ...valid, files: [{ path: 'a', url, sha1: SHA1 }] }), /http\(s\)/, url)
  }
})

test('rechaza sha1 malformado', () => {
  for (const sha1 of ['', 'abc', 'z'.repeat(40), 'a'.repeat(39)]) {
    assert.throws(() => parseManifest({ ...valid, files: [{ path: 'a', url: 'https://c/a', sha1 }] }), /sha1/)
  }
})

test('rechaza size negativo o no entero', () => {
  for (const size of [-1, 1.5]) {
    assert.throws(() => parseManifest({ ...valid, files: [{ path: 'a', url: 'https://c/a', sha1: SHA1, size }] }))
  }
})

test('exige los campos obligatorios y dice cuál falta', () => {
  const { minecraft, ...sinMinecraft } = valid
  assert.throws(() => parseManifest(sinMinecraft), /minecraft/)
  assert.throws(() => parseManifest(null), ManifestError)
  assert.throws(() => parseManifest('no soy un objeto'), ManifestError)
})

test('rechaza external con targetPath inseguro', () => {
  const bad = {
    ...valid,
    external: [{ name: 'x', source: 'curseforge', targetPath: '../../x.jar' }]
  }
  assert.throws(() => parseManifest(bad), /ruta relativa insegura/)
})

test('fetchManifest rechaza URLs no http(s) sin hacer request', async () => {
  let called = false
  const fetchFn = async (): Promise<Response> => {
    called = true
    return new Response('{}')
  }
  await assert.rejects(() => fetchManifest('file:///etc/passwd', fetchFn), /URL de manifiesto inválida/)
  assert.equal(called, false)
})

test('fetchManifest reporta HTTP != 200 y JSON inválido', async () => {
  const notFound = async (): Promise<Response> => new Response('nope', { status: 404 })
  await assert.rejects(() => fetchManifest('https://c/m.json', notFound), /HTTP 404/)

  const badJson = async (): Promise<Response> => new Response('{no json', { status: 200 })
  await assert.rejects(() => fetchManifest('https://c/m.json', badJson), /no es JSON válido/)
})

test('rechaza archivos con path duplicado (evita la carrera de .part)', () => {
  const dup = {
    ...valid,
    files: [
      { path: 'mods/a.jar', url: 'https://c/1', sha1: SHA1 },
      { path: 'mods/a.jar', url: 'https://c/2', sha1: SHA1 }
    ]
  }
  assert.throws(() => parseManifest(dup), /duplicada/)
})

test('fetchManifest corta un cuerpo gigante en vez de tragárselo', async () => {
  const huge = 'x'.repeat(9 * 1024 * 1024)
  const fetchFn = async (): Promise<Response> => new Response(huge, { status: 200 })
  await assert.rejects(() => fetchManifest('https://c/m.json', fetchFn), /demasiado grande/)
})
