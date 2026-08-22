import { normalizePartName } from './parseMarketplacePaste'

const STORAGE_KEY = 'rc-part-prices'

// Normaliza as chaves ao ler -- cobre o caso de já existir algo salvo no
// localStorage de antes da correção do bug de espaço não-quebrável ( ),
// que faria a chave nunca bater na hora de buscar o preço.
function normalizeKeys(prices: Record<string, number>): Record<string, number> {
  const normalized: Record<string, number> = {}
  for (const [key, value] of Object.entries(prices)) {
    normalized[normalizePartName(key)] = value
  }
  return normalized
}

export function readStoredPartPrices(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeKeys(JSON.parse(raw)) : {}
  } catch {
    return {}
  }
}

// Mescla com o que já existe (não substitui tudo) e persiste.
export function mergeStoredPartPrices(newPrices: Record<string, number>): Record<string, number> {
  const merged = { ...readStoredPartPrices(), ...normalizeKeys(newPrices) }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // localStorage indisponível (modo privado etc.) -- segue só em memória
  }
  return merged
}
