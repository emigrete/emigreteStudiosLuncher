import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IDLE_PROGRESS } from '../src/shared/pack.ts'
import { isPlayBusy, playLabel, playPercent, type PlayState } from '../src/shared/play.ts'

test('idle: el label depende de la sesión', () => {
  assert.equal(playLabel({ phase: 'idle' }, true), 'JUGAR')
  assert.equal(playLabel({ phase: 'idle' }, false), 'INICIAR SESIÓN')
})

test('syncing reusa el label del progreso de sync', () => {
  const state: PlayState = { phase: 'syncing', sync: { ...IDLE_PROGRESS, phase: 'downloading', bytesDone: 30, bytesTotal: 100 } }
  assert.equal(playLabel(state, true), '30%')
  assert.equal(playPercent(state), 30)
})

test('los pasos de preparar/instalar son indeterminados (percent null)', () => {
  assert.equal(playPercent({ phase: 'preparing' }), null)
  assert.equal(playPercent({ phase: 'installing-loader' }), null)
  assert.equal(playLabel({ phase: 'preparing' }, true), 'PREPARANDO...')
  assert.equal(playLabel({ phase: 'installing-loader' }, true), 'INSTALANDO NEOFORGE')
})

test('launching muestra % si MCLC reporta progreso, si no un texto', () => {
  assert.equal(playLabel({ phase: 'launching', loader: { type: 'assets', task: 25, total: 100 } }, true), '25%')
  assert.equal(playPercent({ phase: 'launching', loader: { type: 'assets', task: 25, total: 100 } }), 25)
  assert.equal(playLabel({ phase: 'launching' }, true), 'INICIANDO JUEGO')
  assert.equal(playPercent({ phase: 'launching' }), null)
})

test('running = JUGANDO al 100%', () => {
  assert.equal(playLabel({ phase: 'running' }, true), 'JUGANDO')
  assert.equal(playPercent({ phase: 'running' }), 100)
})

test('loaderPercent no se pasa de 100 ni baja de 0', () => {
  assert.equal(playPercent({ phase: 'launching', loader: { type: 'x', task: 200, total: 100 } }), 100)
  assert.equal(playPercent({ phase: 'launching', loader: { type: 'x', task: 5, total: 0 } }), 0)
})

test('isPlayBusy: ocupado salvo idle y error', () => {
  assert.equal(isPlayBusy({ phase: 'idle' }), false)
  assert.equal(isPlayBusy({ phase: 'error', message: 'x' }), false)
  for (const phase of ['syncing', 'preparing', 'installing-loader', 'launching', 'running'] as const) {
    const state = (phase === 'syncing' ? { phase, sync: IDLE_PROGRESS } : { phase }) as PlayState
    assert.equal(isPlayBusy(state), true, phase)
  }
})
