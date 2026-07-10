import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { SyncProgress } from '../src/shared/pack.ts'
import { IDLE_PROGRESS } from '../src/shared/pack.ts'
import { externalNotice, formatBytes, phaseLabel, syncPercent } from '../src/shared/progress.ts'

const progress = (partial: Partial<SyncProgress>): SyncProgress => ({ ...IDLE_PROGRESS, ...partial })

test('el porcentaje usa bytes cuando el manifiesto los declara', () => {
  const p = progress({ phase: 'downloading', bytesDone: 25, bytesTotal: 100, filesDone: 0, filesTotal: 4 })
  assert.equal(syncPercent(p), 25)
})

test('sin bytes declarados cae a la proporción de archivos', () => {
  const p = progress({ phase: 'downloading', bytesTotal: 0, filesDone: 1, filesTotal: 4 })
  assert.equal(syncPercent(p), 25)
})

test('en "checking" mide archivos verificados', () => {
  assert.equal(syncPercent(progress({ phase: 'checking', filesDone: 3, filesTotal: 6 })), 50)
})

test('"done" siempre es 100 y nunca se pasa de 100', () => {
  assert.equal(syncPercent(progress({ phase: 'done' })), 100)
  assert.equal(syncPercent(progress({ phase: 'downloading', bytesDone: 300, bytesTotal: 100 })), 100)
})

test('no explota con división por cero ni NaN', () => {
  assert.equal(syncPercent(IDLE_PROGRESS), 0)
  assert.equal(syncPercent(progress({ phase: 'downloading', bytesDone: 0, bytesTotal: 0, filesTotal: 0 })), 0)
})

test('formatBytes es legible en cada escala', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(-5), '0 B')
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(1024), '1.0 KB')
  assert.equal(formatBytes(1024 * 1024 * 5.5), '5.5 MB')
  assert.equal(formatBytes(1024 ** 3 * 2), '2.0 GB')
  // A partir de 100 en una unidad, los decimales sobran.
  assert.equal(formatBytes(1024 * 150), '150 KB')
})

test('phaseLabel dice qué está pasando', () => {
  assert.equal(phaseLabel(progress({ phase: 'manifest' })), 'LEYENDO MANIFIESTO')
  assert.equal(phaseLabel(progress({ phase: 'checking', filesDone: 2, filesTotal: 9 })), 'VERIFICANDO 2/9')
  assert.equal(phaseLabel(progress({ phase: 'downloading', bytesDone: 50, bytesTotal: 100 })), '50%')
  assert.equal(phaseLabel(progress({ phase: 'done' })), '¡LISTO!')
  assert.equal(phaseLabel(IDLE_PROGRESS), '')
})

test('externalNotice pluraliza bien', () => {
  assert.equal(externalNotice(0), '')
  assert.equal(externalNotice(-3), '')
  assert.equal(externalNotice(1), '1 mod externo requiere descarga manual')
  assert.equal(externalNotice(4), '4 mods externos requieren descarga manual')
})
