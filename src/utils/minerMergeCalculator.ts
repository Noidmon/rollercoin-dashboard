// Fórmula reimplementada por conta própria a partir de comportamento
// observado (RC Calculator, de Ariel Ruiz), só para cálculo pessoal --
// nenhum código-fonte de terceiros foi copiado ou redistribuído aqui.
import type { Miner, MinerMerge } from '../types/miner'

export const FORGE_LEVELS = [
  { level: 1, discount: 0 },
  { level: 2, discount: 0.05 },
  { level: 3, discount: 0.1 },
  { level: 4, discount: 0.15 },
  { level: 5, discount: 0.25 },
] as const

export type PartType = 'fan' | 'wire' | 'hashboard'
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface CraftingPrices {
  common: Record<PartType, number>
  uncommon: Record<PartType, number>
  rare: Record<PartType, number>
  epic: Record<PartType, number>
  legendary: Record<PartType, number>
}

// merges vêm com level 0 = peça não usada nesse nível (count sempre 0
// junto -- confirmado contra os 1673 mineradores reais, nenhuma exceção).
// 1..5 = a raridade real da peça naquele nível: só existem 5 valores
// não-zero de level nos dados reais, batendo exatamente com as 5 chaves
// de crafting-prices.json, então o mapeamento é 1=common .. 5=legendary
// (não 0=common como se poderia supor -- confirmado antes de assumir).
const LEVEL_TO_RARITY: Record<number, Rarity> = {
  1: 'common',
  2: 'uncommon',
  3: 'rare',
  4: 'epic',
  5: 'legendary',
}

export function levelToRarity(level: number): Rarity | null {
  return LEVEL_TO_RARITY[level] ?? null
}

const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
}

const TYPE_LABEL: Record<PartType, string> = {
  fan: 'Fan',
  wire: 'Wire',
  hashboard: 'Hashboard',
}

export function partPriceKey(rarity: Rarity, type: PartType): string {
  return `${RARITY_LABEL[rarity]} ${TYPE_LABEL[type]}`
}

// A raridade "do nível de merge" como um todo -- na prática quase todo
// merge usa só 1 tipo de peça (fan OU wire OU hashboard); um punhado usa os
// 3 ao mesmo tempo, sempre no mesmo level entre eles. Pega o maior level
// presente, que cobre os dois casos.
export function getMergeLevelRarity(merge: MinerMerge): Rarity | null {
  const level = Math.max(merge.fanLevel, merge.wireLevel, merge.hashboardLevel)
  return levelToRarity(level)
}

function getPartPrice(
  type: PartType,
  level: number,
  overridePrices: Record<string, number>,
  craftingPrices: CraftingPrices,
): number {
  const rarity = levelToRarity(level)
  if (!rarity) return 0
  const key = partPriceKey(rarity, type)
  const override = overridePrices[key]
  return override !== undefined ? override : craftingPrices[rarity][type]
}

// power dos mineradores/merges vem em Gh/s (mesma convenção de
// formatPower.ts) -- Ph/s = Gh/s ÷ 1_000_000 (Gh->Th->Ph, ÷1000 cada).
function powerGhSToPhS(powerGhS: number): number {
  return powerGhS / 1_000_000
}

export interface MergeCostRow {
  merge: MinerMerge
  totalPieces: number
  piecesCost: number
  mergeFeeCost: number
  piecesPlusFee: number
  finalCost: number
  ratioPower: number
}

export function calculateMergeCostTable(
  miner: Pick<Miner, 'merges'>,
  forgeDiscount: number,
  overridePrices: Record<string, number>,
  craftingPrices: CraftingPrices,
): MergeCostRow[] {
  const sortedMerges = [...miner.merges].sort((a, b) => a.level - b.level)
  const rows: MergeCostRow[] = []
  let previousFinalCost = 0

  for (const merge of sortedMerges) {
    const fanPrice = getPartPrice('fan', merge.fanLevel, overridePrices, craftingPrices)
    const wirePrice = getPartPrice('wire', merge.wireLevel, overridePrices, craftingPrices)
    const hashboardPrice = getPartPrice(
      'hashboard',
      merge.hashboardLevel,
      overridePrices,
      craftingPrices,
    )

    const piecesCost =
      merge.fanCount * fanPrice +
      merge.wireCount * wirePrice +
      merge.hashboardCount * hashboardPrice
    const totalPieces = merge.fanCount + merge.wireCount + merge.hashboardCount

    const piecesCostDiscounted = piecesCost * (1 - forgeDiscount)
    const mergeFeeDiscounted = merge.mergeFee * (1 - forgeDiscount)
    const piecesPlusFee = piecesCostDiscounted + mergeFeeDiscounted

    const finalCost = piecesPlusFee + merge.requiredPreviousCount * previousFinalCost
    previousFinalCost = finalCost

    const powerPhS = powerGhSToPhS(merge.power)
    const ratioPower = powerPhS > 0 ? finalCost / powerPhS : 0

    rows.push({
      merge,
      totalPieces,
      piecesCost: piecesCostDiscounted,
      mergeFeeCost: mergeFeeDiscounted,
      piecesPlusFee,
      finalCost,
      ratioPower,
    })
  }

  return rows
}
