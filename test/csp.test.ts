import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCsp, isAppUrl } from '../src/main/services/csp.ts'

const DEV_URL = 'http://localhost:5173'

test('la UI servida por file:// es de la app', () => {
  assert.equal(isAppUrl('file:///home/x/out/renderer/index.html'), true)
  assert.equal(isAppUrl('file:///home/x/out/renderer/assets/index.js'), true)
})

test('en dev, el server de Vite es de la app', () => {
  assert.equal(isAppUrl(`${DEV_URL}/src/main.tsx`, DEV_URL), true)
})

test('el login de Microsoft NO es de la app: no debe recibir nuestra CSP', () => {
  const login = 'https://login.live.com/oauth20_authorize.srf?client_id=abc'
  assert.equal(isAppUrl(login), false)
  assert.equal(isAppUrl(login, DEV_URL), false)
})

test('el skin de Mojang tampoco recibe la CSP', () => {
  assert.equal(isAppUrl('https://textures.minecraft.net/texture/abc', DEV_URL), false)
})

test('sin URL de dev, http local no cuenta como app', () => {
  assert.equal(isAppUrl(`${DEV_URL}/index.html`), false)
  assert.equal(isAppUrl(`${DEV_URL}/index.html`, ''), false)
})

test('la CSP de producción es estricta y la de dev habilita el HMR', () => {
  const prod = buildCsp(false)
  assert.match(prod, /script-src 'self';/)
  assert.doesNotMatch(prod, /unsafe-eval/)
  assert.match(prod, /font-src 'self' data:/)

  const dev = buildCsp(true)
  assert.match(dev, /unsafe-eval/)
  assert.match(dev, /ws:\/\/localhost:\*/)
})
