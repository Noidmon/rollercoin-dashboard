import type { MatchedMinerEntry } from './matchMinersInventory'
import type { PartInventoryEntry } from './parsePartsInventory'

const MINERS_INVENTORY_KEY = 'rc-miners-inventory'
const PARTS_INVENTORY_KEY = 'rc-parts-inventory'
const REAL_FORGE_LEVEL_KEY = 'rc-real-forge-level'

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

export function readMinersInventory(): MatchedMinerEntry[] {
  return safeRead(MINERS_INVENTORY_KEY, [])
}

export function writeMinersInventory(entries: MatchedMinerEntry[]) {
  safeWrite(MINERS_INVENTORY_KEY, entries)
}

export function readPartsInventory(): PartInventoryEntry[] {
  return safeRead(PARTS_INVENTORY_KEY, [])
}

export function writePartsInventory(entries: PartInventoryEntry[]) {
  safeWrite(PARTS_INVENTORY_KEY, entries)
}

// Nível da Forja REAL da conta do jogador -- diferente do seletor
// hipotético de /mineradores/:slug (esse não persiste, é só simulação).
export function readRealForgeLevel(): number {
  return safeRead(REAL_FORGE_LEVEL_KEY, 1)
}

export function writeRealForgeLevel(level: number) {
  safeWrite(REAL_FORGE_LEVEL_KEY, level)
}
