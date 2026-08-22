import { ASSET_MANIFEST } from '../data/assetManifest'

export function resolveAssetUrl(imagePath: string): string {
  const local = ASSET_MANIFEST[imagePath]
  if (local) return local
  return `https://api.minaryganar.com/assets/${imagePath}` // fallback temporário até sincronizar
}
