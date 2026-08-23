import type { Miner } from '../types/miner'
import type { MatchedMinerEntry } from './matchMinersInventory'
import type { PartInventoryEntry } from './parsePartsInventory'
import {
  getActiveParts,
  getPartPrice,
  type CraftingPrices,
  type PartType,
  type Rarity,
} from './minerMergeCalculator'

export interface PartNeed {
  type: PartType
  rarity: Rarity
  needed: number
  owned: number
  missing: number
  missingCost: number
}

export interface MergeNeed {
  minerId: string
  minerName: string
  minerImage: string | null
  currentLevel: number // 0 = base
  ownedAtCurrentLevel: number
  nextLevel: number
  requiredCopies: number
  missingCopies: number
  partsNeeded: PartNeed[]
  mergeFeeCost: number
  totalMissingPartsCost: number
  ready: boolean
}

// Pra cada minerador mergeable que o jogador possui (em qualquer nível,
// incluindo base), calcula o que falta pro PRÓXIMO nível de merge --
// reaproveita getActiveParts/getPartPrice de minerMergeCalculator.ts (mesma
// lógica de preço colado > fallback crafting-prices.json + desconto de
// forja já usada em /mineradores/:slug, sem duplicar).
export function computeMergeNeeds(
  ownedEntries: MatchedMinerEntry[],
  miners: Miner[],
  partsInventory: PartInventoryEntry[],
  forgeDiscount: number,
  partPrices: Record<string, number>,
  craftingPrices: CraftingPrices,
): MergeNeed[] {
  const ownedByNameLevel = new Map<string, number>()
  for (const entry of ownedEntries) {
    const key = `${entry.name}::${entry.matchedLevel}`
    ownedByNameLevel.set(key, (ownedByNameLevel.get(key) ?? 0) + entry.quantity)
  }

  // nível MÁXIMO possuído de cada minerador -- é a partir dele que o
  // próximo merge seria feito
  const maxLevelByName = new Map<string, number>()
  for (const entry of ownedEntries) {
    const current = maxLevelByName.get(entry.name)
    if (current === undefined || entry.matchedLevel > current) {
      maxLevelByName.set(entry.name, entry.matchedLevel)
    }
  }

  const partsOwned = new Map<string, number>()
  for (const p of partsInventory) {
    partsOwned.set(`${p.rarity}:${p.type}`, p.quantity)
  }

  const needs: MergeNeed[] = []

  for (const [name, currentLevel] of maxLevelByName) {
    const miner = miners.find((m) => m.name === name)
    if (!miner || !miner.mergeable || miner.merges.length === 0) continue

    const sortedMerges = [...miner.merges].sort((a, b) => a.level - b.level)
    const nextMerge =
      currentLevel === 0
        ? sortedMerges[0]
        : sortedMerges[sortedMerges.findIndex((mg) => mg.level === currentLevel) + 1]

    if (!nextMerge) continue // já no nível máximo, nada a mesclar

    const ownedAtCurrentLevel = ownedByNameLevel.get(`${name}::${currentLevel}`) ?? 0
    const missingCopies = Math.max(0, nextMerge.requiredPreviousCount - ownedAtCurrentLevel)

    const partsNeeded: PartNeed[] = getActiveParts(nextMerge).map((p) => {
      const owned = partsOwned.get(`${p.rarity}:${p.type}`) ?? 0
      const missing = Math.max(0, p.count - owned)
      const price = getPartPrice(p.rarity, p.type, partPrices, craftingPrices)
      const missingCost = missing * price * (1 - forgeDiscount)
      return { type: p.type, rarity: p.rarity, needed: p.count, owned, missing, missingCost }
    })

    const totalMissingPartsCost = partsNeeded.reduce((sum, p) => sum + p.missingCost, 0)
    const mergeFeeCost = nextMerge.mergeFee * (1 - forgeDiscount)
    const ready = missingCopies === 0 && partsNeeded.every((p) => p.missing === 0)

    needs.push({
      minerId: miner.id,
      minerName: miner.name,
      minerImage: miner.image,
      currentLevel,
      ownedAtCurrentLevel,
      nextLevel: nextMerge.level,
      requiredCopies: nextMerge.requiredPreviousCount,
      missingCopies,
      partsNeeded,
      mergeFeeCost,
      totalMissingPartsCost,
      ready,
    })
  }

  return needs.sort((a, b) => a.minerName.localeCompare(b.minerName))
}
