import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CONFIG, isValidManifestUrl, sanitizeConfig } from '../src/shared/config.ts'

test('sanitizeConfig recorta la URL y aplica defaults de RAM', () => {
  const c = sanitizeConfig({ manifestUrl: '  https://cdn/m.json  ' })
  assert.equal(c.manifestUrl, 'https://cdn/m.json')
  assert.equal(c.ramMaxMb, DEFAULT_CONFIG.ramMaxMb)
})

test('sanitizeConfig clampea la RAM a un rango sensato', () => {
  assert.equal(sanitizeConfig({ ramMaxMb: 999999 }).ramMaxMb, 32768)
  assert.equal(sanitizeConfig({ ramMaxMb: 10 }).ramMaxMb, 1024)
  assert.equal(sanitizeConfig({ ramMaxMb: 8192.7 }).ramMaxMb, 8193)
})

test('el mínimo de RAM nunca supera al máximo', () => {
  const c = sanitizeConfig({ ramMaxMb: 2048, ramMinMb: 8192 })
  assert.equal(c.ramMinMb, 2048)
})

test('sanitizeConfig tolera basura', () => {
  assert.deepEqual(sanitizeConfig(null), DEFAULT_CONFIG)
  assert.deepEqual(sanitizeConfig('nope'), DEFAULT_CONFIG)
  assert.deepEqual(sanitizeConfig({ manifestUrl: 123, extra: 'x' }), DEFAULT_CONFIG)
})

test('isValidManifestUrl: vacía es válida (sin configurar); esquema http(s) obligatorio', () => {
  assert.equal(isValidManifestUrl(''), true)
  assert.equal(isValidManifestUrl('https://cdn/m.json'), true)
  assert.equal(isValidManifestUrl('http://localhost:8080/m.json'), true)
  assert.equal(isValidManifestUrl('file:///etc/passwd'), false)
  assert.equal(isValidManifestUrl('no soy una url'), false)
})
