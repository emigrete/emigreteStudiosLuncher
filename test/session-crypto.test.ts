import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import {
  localEncrypt,
  localDecrypt,
  frame,
  unframe,
  TAG_LOCAL_AES,
  LOCAL_KEY_BYTES
} from '../src/main/services/session-crypto.ts'

test('localEncrypt/localDecrypt hacen roundtrip con la misma clave', () => {
  const key = randomBytes(LOCAL_KEY_BYTES)
  const token = 'M.R3_BAY.super-secreto-refresh-token-1234567890'
  const blob = localEncrypt(token, key)
  assert.notEqual(blob.toString('utf8'), token) // no es texto plano
  assert.equal(localDecrypt(blob, key), token)
})

test('localDecrypt con otra clave falla (GCM auth)', () => {
  const blob = localEncrypt('secreto', randomBytes(LOCAL_KEY_BYTES))
  assert.throws(() => localDecrypt(blob, randomBytes(LOCAL_KEY_BYTES)))
})

test('localDecrypt con ciphertext alterado falla (integridad)', () => {
  const key = randomBytes(LOCAL_KEY_BYTES)
  const blob = localEncrypt('secreto', key)
  blob[blob.length - 1] ^= 0xff // corrompe el último byte
  assert.throws(() => localDecrypt(blob, key))
})

test('cada cifrado usa un IV distinto (no determinístico)', () => {
  const key = randomBytes(LOCAL_KEY_BYTES)
  assert.notDeepEqual(localEncrypt('x', key), localEncrypt('x', key))
})

test('rechaza claves de tamaño incorrecto', () => {
  assert.throws(() => localEncrypt('x', randomBytes(16)))
  assert.throws(() => localDecrypt(randomBytes(40), randomBytes(16)))
})

test('frame/unframe hacen roundtrip y preservan el tag', () => {
  const payload = randomBytes(20)
  const framed = frame(TAG_LOCAL_AES, payload)
  const { tag, payload: back } = unframe(framed)
  assert.equal(tag, TAG_LOCAL_AES)
  assert.deepEqual(back, payload)
})
