import { net, nativeImage } from 'electron'

/**
 * Cabeza del jugador a partir del skin oficial de Mojang.
 *
 * Evitamos servicios de terceros (Crafatar/Minotar): bajamos el PNG del skin,
 * recortamos la cara (8x8 en 8,8) componiendo la capa del sombrero (8,8 en 40,8)
 * y devolvemos un data URL de 8x8. El renderer lo escala con `image-rendering:
 * pixelated`, así que se ve nítido y auténtico.
 *
 * Ventaja extra: al ser `data:`, la CSP de producción sigue siendo `img-src 'self' data:`.
 */

const HEAD = { x: 8, y: 8, size: 8 } as const
const HAT = { x: 40, y: 8 } as const
const FETCH_TIMEOUT_MS = 6000

/** Cache en memoria por uuid: evita re-bajar el skin en cada arranque de la UI. */
const cache = new Map<string, string | null>()

export async function playerHeadDataUrl(uuid: string, skinUrl: string | undefined): Promise<string | null> {
  const cached = cache.get(uuid)
  if (cached !== undefined) return cached

  const head = skinUrl ? await downloadHead(skinUrl) : null
  cache.set(uuid, head)
  return head
}

export function clearAvatarCache(): void {
  cache.clear()
}

async function downloadHead(skinUrl: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await net.fetch(skinUrl, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return cropHead(Buffer.from(await res.arrayBuffer()))
  } catch (error) {
    console.warn('[avatar] no se pudo obtener el skin:', error)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Recorta la cara + sombrero de un skin (64x64 o 64x32 legacy) y la devuelve como data URL 8x8. */
function cropHead(png: Buffer): string | null {
  const skin = nativeImage.createFromBuffer(png)
  const { width, height } = skin.getSize()
  // Ambos formatos de skin tienen cara y sombrero dentro de estos límites.
  if (width < 64 || height < 32) return null

  const bmp = skin.toBitmap() // BGRA
  const out = Buffer.alloc(HEAD.size * HEAD.size * 4)
  const offset = (x: number, y: number): number => (y * width + x) * 4

  for (let y = 0; y < HEAD.size; y++) {
    for (let x = 0; x < HEAD.size; x++) {
      const face = offset(HEAD.x + x, HEAD.y + y)
      const hat = offset(HAT.x + x, HAT.y + y)
      // El sombrero tapa la cara solo donde es opaco.
      const src = bmp[hat + 3] > 0 ? hat : face
      const dst = (y * HEAD.size + x) * 4
      out[dst] = bmp[src]
      out[dst + 1] = bmp[src + 1]
      out[dst + 2] = bmp[src + 2]
      out[dst + 3] = 255
    }
  }

  return nativeImage.createFromBitmap(out, { width: HEAD.size, height: HEAD.size }).toDataURL()
}
