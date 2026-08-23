import type { Miner } from '../types/miner'
import type { MinerInventoryEntry } from './parseMinersInventory'

export interface MatchedMinerEntry {
  name: string
  quantity: number
  sellable: boolean
  matchedLevel: number // 0 = base, N = level do merge correspondente
}

export interface MatchInventoryResult {
  matched: MatchedMinerEntry[]
  unrecognized: MinerInventoryEntry[]
}

// A tela do jogo trunca o Power exibido (ex: "3.979 Ph/s" pro valor real
// 3979500 Gh/s), então a comparação precisa de uma tolerância -- 0.5% cobre
// esse arredondamento sem risco real de confundir dois níveis distintos
// (a diferença de power entre níveis consecutivos é sempre bem maior que
// isso).
const POWER_TOLERANCE = 0.005

function powersMatch(a: number, b: number): boolean {
  if (b === 0) return a === 0
  return Math.abs(a - b) / b <= POWER_TOLERANCE
}

// Casa cada entrada do inventário colado com o minerador + nível de merge
// correspondente em miners.json, comparando o power (não dá pra usar só o
// nome -- o mesmo minerador aparece várias vezes no inventário, uma por
// nível de merge diferente que o jogador já fez).
export function matchMinersInventory(
  entries: MinerInventoryEntry[],
  miners: Miner[],
): MatchInventoryResult {
  const matched: MatchedMinerEntry[] = []
  const unrecognized: MinerInventoryEntry[] = []

  for (const entry of entries) {
    const miner = miners.find((m) => m.name === entry.name)
    if (!miner) {
      unrecognized.push(entry)
      continue
    }

    let matchedLevel: number | null = null
    if (powersMatch(entry.powerValue, miner.power)) {
      matchedLevel = 0
    } else {
      const mergeMatch = miner.merges.find((mg) => powersMatch(entry.powerValue, mg.power))
      if (mergeMatch) matchedLevel = mergeMatch.level
    }

    if (matchedLevel === null) {
      unrecognized.push(entry)
    } else {
      matched.push({
        name: entry.name,
        quantity: entry.quantity,
        sellable: entry.sellable,
        matchedLevel,
      })
    }
  }

  return { matched, unrecognized }
}
