// Inventário de mineradores e de peças (quantidades possuídas) NÃO
// persistem mais -- o jogador precisa colar de novo a cada visita em
// /merges (dado muda toda hora, ficar velho em localStorage é pior que
// pedir pra colar de novo). Só ficam em estado React (memória da sessão).
// Nível da Forja real e preço de peças continuam persistentes -- mudam bem
// menos e não têm o mesmo risco de ficar desatualizado.

const REAL_FORGE_LEVEL_KEY = 'rc-real-forge-level'
const LEGACY_KEYS_TO_CLEAR = ['rc-miners-inventory', 'rc-parts-inventory']

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function safeWrite(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage indisponível (modo privado etc.) -- segue só em memória
  }
}

// Limpa as chaves antigas de inventário (rc-miners-inventory/
// rc-parts-inventory) que não são mais escritas -- silencioso, chamado uma
// vez ao carregar /merges, só pra não deixar lixo órfão acumulado de
// sessões anteriores a essa mudança.
export function clearLegacyInventoryKeys() {
  try {
    for (const key of LEGACY_KEYS_TO_CLEAR) localStorage.removeItem(key)
  } catch {
    // localStorage indisponível -- não tem o que limpar mesmo
  }
}

// Nível da Forja REAL da conta do jogador -- diferente do seletor
// hipotético de /mineradores/:slug (esse não persiste, é só simulação).
export function readRealForgeLevel(): number {
  return safeRead(REAL_FORGE_LEVEL_KEY, 1)
}

export function writeRealForgeLevel(level: number) {
  safeWrite(REAL_FORGE_LEVEL_KEY, level)
}
