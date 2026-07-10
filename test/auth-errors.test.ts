import { test } from 'node:test'
import assert from 'node:assert/strict'
import { friendlyAuthError, toErrorCode } from '../src/main/services/auth-errors.ts'

test('cerrar la ventana de Microsoft se marca como cancelado, no como error', () => {
  const result = friendlyAuthError('error.gui.closed')
  assert.equal(result.cancelled, true)
  assert.match(result.message, /Cancelaste/)
})

test('un fallo real no se marca como cancelado', () => {
  assert.equal(friendlyAuthError('error.auth.microsoft').cancelled, false)
})

test('elige el mensaje MÁS específico cuando varios prefijos coinciden', () => {
  // 'error.auth.xsts.child.SK' también empieza con 'error.auth.xsts' y 'error.auth'.
  assert.match(friendlyAuthError('error.auth.xsts.child.SK').message, /menor/)
  assert.match(friendlyAuthError('error.auth.xsts.bannedCountry').message, /país/)
  assert.match(friendlyAuthError('error.auth.xsts').message, /Xbox Live rechazó/)
})

test('una cuenta sin Java Edition da un mensaje claro', () => {
  assert.match(friendlyAuthError('error.auth.minecraft.profile').message, /no tiene Minecraft/)
  assert.match(friendlyAuthError('error.auth.minecraft.entitlements').message, /no tiene Minecraft/)
})

test('los subcódigos caen en su padre', () => {
  assert.match(friendlyAuthError('error.state.invalid.electron').message, /respuesta inválida/)
})

test('un código desconocido usa el mensaje por defecto', () => {
  const result = friendlyAuthError('algo.totalmente.inesperado')
  assert.equal(result.cancelled, false)
  assert.match(result.message, /Intentá de nuevo/)
})

test('toErrorCode normaliza strings, Error y objetos de msmc', () => {
  assert.equal(toErrorCode('error.gui.closed'), 'error.gui.closed')
  assert.equal(toErrorCode(new Error('error.auth.microsoft')), 'error.auth.microsoft')
  assert.equal(toErrorCode({ reason: 'error.auth.xsts' }), 'error.auth.xsts')
  assert.equal(toErrorCode(undefined), 'error.auth')
  assert.equal(toErrorCode(null), 'error.auth')
})

test('un Error envuelto sigue mapeando al mensaje correcto', () => {
  assert.match(friendlyAuthError(new Error('error.auth.xsts.userNotFound')).message, /Xbox Live/)
})
