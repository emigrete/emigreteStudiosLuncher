import { isIP } from 'node:net'
import { lookup as dnsLookup } from 'node:dns/promises'
import type { FetchLike } from './downloader'

/**
 * Defensa SSRF para la descarga del modpack.
 *
 * El manifiesto es remoto y define URLs. Sin control, un manifiesto (o un CDN
 * malicioso vía redirect) podría hacernos pegarle a `http://169.254.169.254`
 * (metadata de la nube) o a la red local del usuario. Acá:
 *   - exigimos https (http solo con opt-in explícito),
 *   - rechazamos hosts privados/reservados (por IP literal y por lo que resuelve DNS),
 *   - seguimos los redirects a mano, revalidando CADA salto.
 */

export interface NetworkPolicy {
  /** Permitir http:// (default false). Para desarrollo/LAN. */
  allowInsecureHttp: boolean
  /** Permitir hosts privados/loopback (default false). Necesario para tests locales. */
  allowPrivateHosts: boolean
}

export const STRICT_POLICY: NetworkPolicy = { allowInsecureHttp: false, allowPrivateHosts: false }

/** Política desde variables de entorno (la usa el proceso main). */
export function policyFromEnv(env: NodeJS.ProcessEnv): NetworkPolicy {
  return {
    allowInsecureHttp: env.PACK_ALLOW_INSECURE_HTTP === '1',
    allowPrivateHosts: env.PACK_ALLOW_PRIVATE_HOSTS === '1'
  }
}

const MAX_REDIRECTS = 5

export type DnsLookup = (host: string) => Promise<Array<{ address: string }>>

const defaultLookup: DnsLookup = (host) => dnsLookup(host, { all: true })

export class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

/** ¿La IP (v4 o v6) es privada, loopback, link-local o reservada? */
export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return isPrivateIpv4(ip)
  if (version === 6) return isPrivateIpv6(ip.toLowerCase())
  return true // no es una IP válida: por las dudas, la bloqueamos
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true // link-local
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  if (a >= 224) return true // multicast + reservado
  return false
}

function isPrivateIpv6(ip: string): boolean {
  if (ip === '::1' || ip === '::') return true
  if (ip.startsWith('::ffff:')) {
    // IPv4-mapped: revisamos la parte v4.
    const v4 = ip.slice('::ffff:'.length)
    return isIP(v4) === 4 ? isPrivateIpv4(v4) : true
  }
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true // ULA fc00::/7
  if (/^fe[89ab]/.test(ip)) return true // link-local fe80::/10
  if (ip.startsWith('ff')) return true // multicast
  return false
}

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '')
  return h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')
}

/** Valida esquema + host. Lanza `NetworkError` si no está permitido. */
export async function assertAllowedUrl(
  rawUrl: string,
  policy: NetworkPolicy,
  lookup: DnsLookup = defaultLookup
): Promise<void> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new NetworkError(`URL inválida: ${rawUrl}`)
  }

  if (url.protocol === 'http:') {
    if (!policy.allowInsecureHttp) throw new NetworkError('Se requiere https para descargar el modpack.')
  } else if (url.protocol !== 'https:') {
    throw new NetworkError(`Esquema no permitido: ${url.protocol}`)
  }

  if (policy.allowPrivateHosts) return

  const host = url.hostname.replace(/^\[|\]$/g, '') // saca corchetes de IPv6
  if (isBlockedHostname(host)) throw new NetworkError(`Host no permitido: ${host}`)

  if (isIP(host)) {
    if (isPrivateIp(host)) throw new NetworkError(`Host privado no permitido: ${host}`)
    return
  }

  const resolved = await lookup(host).catch(() => {
    throw new NetworkError(`No se pudo resolver ${host}`)
  })
  if (resolved.length === 0) throw new NetworkError(`No se pudo resolver ${host}`)
  for (const { address } of resolved) {
    if (isPrivateIp(address)) throw new NetworkError(`${host} resuelve a una IP privada`)
  }
}

/**
 * Envuelve un fetch para que sea seguro: valida el destino, sigue los redirects
 * a mano revalidando cada salto, y cachea la validación por host dentro de la sync.
 */
export function createSafeFetch(fetchFn: FetchLike, policy: NetworkPolicy, lookup: DnsLookup = defaultLookup): FetchLike {
  const validated = new Set<string>()

  const check = async (target: string): Promise<void> => {
    const key = new URL(target).host
    if (validated.has(key)) return
    await assertAllowedUrl(target, policy, lookup)
    validated.add(key)
  }

  return async (url, init) => {
    let current = url
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await check(current)
      const response = await fetchFn(current, { ...init, redirect: 'manual' })
      if (response.status < 300 || response.status >= 400) return response

      const location = response.headers.get('location')
      await response.body?.cancel?.().catch(() => undefined)
      if (!location) return response
      current = new URL(location, current).toString()
    }
    throw new NetworkError('Demasiados redirects')
  }
}
