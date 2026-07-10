#!/usr/bin/env node
// make-manifest.mjs — genera el manifiesto del modpack a partir de una carpeta.
//
//   node scripts/make-manifest.mjs \
//     --root ./pack --base-url https://tu-cdn/pack --out manifest.json \
//     --pack-version 0.1.0 --minecraft 1.21.1 --loader neoforge:21.1.0
//
// Recorre `--root`, calcula sha1 + tamaño de cada archivo y arma el JSON que
// consume el launcher. Los mods que no podés redistribuir van a mano en `external`.

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, stat, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'

const IGNORED = new Set(['.sync-cache.json', '.DS_Store', 'Thumbs.db'])
const IGNORED_SUFFIX = ['.part']

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]
    if (!key?.startsWith('--')) fail(`Argumento inesperado: ${key}`)
    const value = argv[i + 1]
    if (value === undefined) fail(`Falta el valor de ${key}`)
    args[key.slice(2)] = value
  }
  return args
}

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (entry.isFile()) yield full
  }
}

async function sha1(file) {
  const hash = createHash('sha1')
  await pipeline(createReadStream(file), hash)
  return hash.digest('hex')
}

/** URL segura: codifica cada segmento, no la barra. */
function joinUrl(base, relPath) {
  const clean = base.replace(/\/+$/, '')
  const encoded = relPath.split('/').map(encodeURIComponent).join('/')
  return `${clean}/${encoded}`
}

const args = parseArgs(process.argv.slice(2))
const root = args.root ?? fail('Falta --root')
const baseUrl = args['base-url'] ?? fail('Falta --base-url')
const out = args.out ?? 'manifest.json'

if (!/^https?:\/\//i.test(baseUrl)) fail('--base-url debe ser http(s)')

const [loaderType, loaderVersion] = (args.loader ?? 'neoforge:VERIFICAR').split(':')

const files = []
let totalBytes = 0

for await (const absolute of walk(root)) {
  const relPath = relative(root, absolute).split(sep).join('/')
  const name = relPath.split('/').pop()
  if (IGNORED.has(name) || IGNORED_SUFFIX.some((s) => name.endsWith(s))) continue

  const { size } = await stat(absolute)
  files.push({ path: relPath, url: joinUrl(baseUrl, relPath), sha1: await sha1(absolute), size })
  totalBytes += size
}

files.sort((a, b) => a.path.localeCompare(b.path))

const manifest = {
  packName: args['pack-name'] ?? 'El Caballero de Netherite',
  packVersion: args['pack-version'] ?? '0.1.0',
  minecraft: args.minecraft ?? '1.21.1',
  loader: { type: loaderType, version: loaderVersion ?? 'VERIFICAR' },
  java: { major: Number(args['java-major'] ?? 21) },
  files,
  external: []
}

await writeFile(out, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

const mb = (totalBytes / 1024 ** 2).toFixed(1)
console.log(`✓ ${out}: ${files.length} archivos, ${mb} MB`)
if (manifest.loader.version === 'VERIFICAR') {
  console.warn('⚠ loader.version quedó en "VERIFICAR": pasá --loader neoforge:<version>')
}
