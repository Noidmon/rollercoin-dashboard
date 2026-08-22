const STORAGE_KEY = 'rc-part-prices'

export function readStoredPartPrices(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

// Mescla com o que já existe (não substitui tudo) e persiste.
export function mergeStoredPartPrices(newPrices: Record<string, number>): Record<string, number> {
  const merged = { ...readStoredPartPrices(), ...newPrices }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // localStorage indisponível (modo privado etc.) -- segue só em memória
  }
  return merged
}
