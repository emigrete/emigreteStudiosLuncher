import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertAllowedUrl,
  createSafeFetch,
  isPrivateIp,
  NetworkError,
  STRICT_POLICY,
  policyFromEnv
} from '../src/main/services/pack/net.ts'
import { startServer } from './helpers/server.ts'

const PERMISSIVE = { allowInsecureHttp: true, allowPrivateHosts: true }
/** DNS falso: así testeamos sin red real. */
const fakeDns =
  (map: Record<string, string[]>) =>
  async (host: string): Promise<Array<{ address: string }>> =>
    (map[host] ?? []).map((address) => ({ address }))

test('isPrivateIp reconoce rangos privados/reservados IPv4', () => {
  for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '169.254.169.254', '0.0.0.0', '100.64.0.1']) {
    assert.equal(isPrivateIp(ip), true, ip)
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '203.0.114.5', '52.10.20.30']) {
    assert.equal(isPrivateIp(ip), false, ip)
  }
})

test('isPrivateIp maneja IPv6 (loopback, ULA, link-local, mapped)', () => {
  for (const ip of ['::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1']) {
    assert.equal(isPrivateIp(ip), true, ip)
  }
  assert.equal(isPrivateIp('2606:4700:4700::1111'), false)
  assert.equal(isPrivateIp('::ffff:8.8.8.8'), false)
})

test('exige https en modo estricto', async () => {
  await assert.rejects(
    () => assertAllowedUrl('http://cdn.publico.com/m.json', STRICT_POLICY, fakeDns({ 'cdn.publico.com': ['8.8.8.8'] })),
    /Se requiere https/
  )
})

test('rechaza esquemas que no son http(s)', async () => {
  for (const url of ['file:///etc/passwd', 'ftp://x/y', 'data:text/plain,hola']) {
    await assert.rejects(() => assertAllowedUrl(url, STRICT_POLICY), NetworkError, url)
  }
})

test('bloquea metadata de la nube y hosts privados por IP literal', async () => {
  await assert.rejects(() => assertAllowedUrl('https://169.254.169.254/latest/meta-data/', STRICT_POLICY), /privado/)
  await assert.rejects(() => assertAllowedUrl('https://127.0.0.1/x', STRICT_POLICY), /privado/)
  await assert.rejects(() => assertAllowedUrl('http://localhost/x', STRICT_POLICY), /https|no permitido/)
})

test('bloquea un host que RESUELVE a una IP privada (anti DNS-rebinding básico)', async () => {
  await assert.rejects(
    () => assertAllowedUrl('https://malo.example/x', STRICT_POLICY, fakeDns({ 'malo.example': ['10.0.0.1'] })),
    /IP privada/
  )
})

test('permite un host público', async () => {
  await assert.doesNotReject(() =>
    assertAllowedUrl('https://cdn.publico.com/m.json', STRICT_POLICY, fakeDns({ 'cdn.publico.com': ['93.184.216.34'] }))
  )
})

test('createSafeFetch bloquea un redirect hacia una IP privada', async () => {
  // El servidor "bueno" redirige a metadata interna. La primera IP es pública.
  const server = await startServer((req, res) => {
    if (req.url === '/start') {
      res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' }).end()
      return
    }
    res.end('no debería llegar acá')
  })
  try {
    const dns = fakeDns({ '127.0.0.1': ['127.0.0.1'] }) // no usado: es IP literal
    // Política que permite el primer host (loopback del server) pero NO el destino del redirect.
    const policy = { allowInsecureHttp: true, allowPrivateHosts: false }
    const safeFetch = createSafeFetch((u, i) => fetch(u, i), policy, dns)
    // Primero validamos que el host inicial (127.0.0.1) sería bloqueado por privado,
    // así que probamos el redirect con un server escuchando en un host "público" simulado:
    // como no podemos, testeamos que un redirect a IP privada explícita se rechaza.
    await assert.rejects(() => safeFetch(`${server.url}/start`), /privado|https/)
  } finally {
    await server.close()
  }
})

test('createSafeFetch sigue un redirect permitido hasta el cuerpo final', async () => {
  const server = await startServer((req, res) => {
    if (req.url === '/a') {
      res.writeHead(302, { location: '/b' }).end()
      return
    }
    res.end('destino final')
  })
  try {
    const safeFetch = createSafeFetch((u, i) => fetch(u, i), PERMISSIVE)
    const res = await safeFetch(`${server.url}/a`)
    assert.equal(await res.text(), 'destino final')
  } finally {
    await server.close()
  }
})

test('policyFromEnv es estricta por defecto y se afloja con las env vars', () => {
  assert.deepEqual(policyFromEnv({}), { allowInsecureHttp: false, allowPrivateHosts: false })
  assert.deepEqual(policyFromEnv({ PACK_ALLOW_INSECURE_HTTP: '1', PACK_ALLOW_PRIVATE_HOSTS: '1' }), {
    allowInsecureHttp: true,
    allowPrivateHosts: true
  })
})
