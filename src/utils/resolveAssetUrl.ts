import { ASSET_MANIFEST } from '../data/assetManifest'
import { withBase } from './withBase'

export function resolveAssetUrl(imagePath: string): string {
  const local = ASSET_MANIFEST[imagePath]
  // withBase só no caminho LOCAL (public/rc-icons/... -- absoluto-raiz,
  // quebra sob o base path do GitHub Pages) -- nunca no fallback externo
  // abaixo, que já é uma URL absoluta de outro domínio.
  if (local) return withBase(local)
  return `https://api.minaryganar.com/assets/${imagePath}` // fallback temporário até sincronizar
}
