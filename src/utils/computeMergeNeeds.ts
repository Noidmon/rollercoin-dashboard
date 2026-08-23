import type { Miner, MinerMerge } from '../types/miner'
import type { MatchedMinerEntry } from './matchMinersInventory'
import type { PartInventoryEntry } from './parsePartsInventory'
import {
  calculateMergeCostTable,
  getActiveParts,
  getPartPrice,
  type CraftingPrices,
  type PartType,
  type Rarity,
} from './minerMergeCalculator'
import { simulatePartCrafting, type PartCraftingResult } from './partCrafting'

export interface PartNeed {
  type: PartType
  rarity: Rarity
  needed: number
  owned: number
  missing: number
  missingCost: number
  // Alternativa de craftar a peça faltante a partir de estoque de raridade
  // menor -- null quando não falta nada OU quando não há nenhum estoque de
  // raridade menor que ajude em nada (não faz sentido oferecer a opção).
  craftAlternative: PartCraftingResult | null
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
  // 'ready' = cópias e peças completas; 'parts-missing' = cópias completas,
  // peças faltando; 'copies-missing' = cópias insuficientes (com ou sem
  // peças) -- usado pelas abas de filtro em /merges.
  status: 'ready' | 'parts-missing' | 'copies-missing'
  // Ratio Poder (custo/Ph) do PRÓXIMO merge -- mesma fórmula recursiva de
  // calculateMergeCostTable usada em /mineradores/:slug, reaproveitada aqui
  // pro badge de qualidade (sem duplicar a conta de finalCost/ratioPower).
  nextRatioPower: number
}

// Compartilhado entre computeMergeNeeds e simulateMergeChain -- as duas
// contas de "peças que faltam pra esse nível de merge" são idênticas.
function computePartsNeeded(
  merge: MinerMerge,
  partsOwned: Map<string, number>,
  forgeDiscount: number,
  partPrices: Record<string, number>,
  craftingPrices: CraftingPrices,
): PartNeed[] {
  return getActiveParts(merge).map((p) => {
    const owned = partsOwned.get(`${p.rarity}:${p.type}`) ?? 0
    const missing = Math.max(0, p.count - owned)
    const price = getPartPrice(p.rarity, p.type, partPrices, craftingPrices)
    const missingCost = missing * price * (1 - forgeDiscount)

    let craftAlternative: PartCraftingResult | null = null
    if (missing > 0) {
      const simulation = simulatePartCrafting(partsOwned, p.rarity, p.type, p.count, forgeDiscount)
      if (Object.keys(simulation.consumedByRarity).length > 0) craftAlternative = simulation
    }

    return { type: p.type, rarity: p.rarity, needed: p.count, owned, missing, missingCost, craftAlternative }
  })
}

export function buildPartsOwnedMap(partsInventory: PartInventoryEntry[]): Map<string, number> {
  const partsOwned = new Map<string, number>()
  for (const p of partsInventory) {
    partsOwned.set(`${p.rarity}:${p.type}`, p.quantity)
  }
  return partsOwned
}

export interface ChainStepDetail {
  fromLevel: number
  toLevel: number
  requiredCopies: number
  // Cópias do fromLevel disponíveis NESSE PONTO da simulação -- pro
  // primeiro passo, é o que o jogador realmente possui; pros passos
  // seguintes, é derivado assumindo que os passos anteriores foram
  // completados via merge (não compra extra), reaproveitando a mesma
  // divisão por requiredPreviousCount usada no cálculo de finalCost.
  availableCopies: number
  missingCopies: number
  mergesPerformed: number
  partsNeeded: PartNeed[]
  mergeFeeCost: number
  ratioPower: number
  power: number
  // Custo acumulado TEÓRICO (calculateMergeCostTable, a partir de
  // fromLevel) pra chegar até esse passo -- não depende de cópias
  // realmente possuídas, é o custo "cadeia completa" mostrado no resumo.
  finalCost: number
}

export interface ChainSimulation {
  steps: ChainStepDetail[]
  // Até onde a simulação avança de fato SÓ com as cópias já possuídas --
  // "Alcance Real".
  reachedLevel: number
  totalMerges: number
  totalFeeCost: number
  leftoverCopies: number
}

// Simula subir a cadeia de merge de um minerador usando só as cópias que o
// jogador já possui no nível atual -- reaproveita calculateMergeCostTable
// (mesma fórmula recursiva de finalCost/ratioPower) e, pra cada passo,
// deriva quantas cópias do próximo nível resultariam de mesclar as cópias
// disponíveis em grupos de requiredPreviousCount (igual à conta já feita
// internamente por finalCost, só que aplicada a CONTAGEM em vez de custo).
// Uma vez que as cópias disponíveis zeram, ficam zeradas nos passos
// seguintes (floor(0/N) = 0), o que automaticamente marca onde a cadeia
// real para -- sem precisar de uma flag de "parou aqui".
export function simulateMergeChain(
  miner: Miner,
  currentLevel: number,
  ownedAtCurrentLevel: number,
  partsOwned: Map<string, number>,
  forgeDiscount: number,
  partPrices: Record<string, number>,
  craftingPrices: CraftingPrices,
): ChainSimulation {
  const sortedMerges = [...miner.merges]
    .filter((mg) => mg.level > currentLevel)
    .sort((a, b) => a.level - b.level)
  const costTable = calculateMergeCostTable(miner, forgeDiscount, partPrices, craftingPrices, {
    fromLevel: currentLevel,
  })

  let copies = ownedAtCurrentLevel
  let reachedLevel = currentLevel
  let totalMerges = 0
  let totalFeeCost = 0
  const steps: ChainStepDetail[] = []

  for (let i = 0; i < sortedMerges.length; i++) {
    const merge = sortedMerges[i]
    const row = costTable[i]
    const fromLevel = i === 0 ? currentLevel : sortedMerges[i - 1].level
    const availableCopies = copies
    const mergesPerformed = Math.floor(availableCopies / merge.requiredPreviousCount)
    const missingCopies = Math.max(0, merge.requiredPreviousCount - availableCopies)

    steps.push({
      fromLevel,
      toLevel: merge.level,
      requiredCopies: merge.requiredPreviousCount,
      availableCopies,
      missingCopies,
      mergesPerformed,
      partsNeeded: computePartsNeeded(merge, partsOwned, forgeDiscount, partPrices, craftingPrices),
      mergeFeeCost: row.mergeFeeCost,
      ratioPower: row.ratioPower,
      power: merge.power,
      finalCost: row.finalCost,
    })

    if (mergesPerformed > 0) {
      reachedLevel = merge.level
      totalMerges += mergesPerformed
      totalFeeCost += mergesPerformed * row.mergeFeeCost
    }
    copies = mergesPerformed
  }

  return { steps, reachedLevel, totalMerges, totalFeeCost, leftoverCopies: copies }
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

  const partsOwned = buildPartsOwnedMap(partsInventory)

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

    const partsNeeded = computePartsNeeded(nextMerge, partsOwned, forgeDiscount, partPrices, craftingPrices)

    const totalMissingPartsCost = partsNeeded.reduce((sum, p) => sum + p.missingCost, 0)
    const mergeFeeCost = nextMerge.mergeFee * (1 - forgeDiscount)
    const partsComplete = partsNeeded.every((p) => p.missing === 0)
    const ready = missingCopies === 0 && partsComplete
    const status: MergeNeed['status'] =
      missingCopies > 0 ? 'copies-missing' : ready ? 'ready' : 'parts-missing'

    const costTable = calculateMergeCostTable(miner, forgeDiscount, partPrices, craftingPrices)
    const nextRatioPower = costTable.find((row) => row.merge.level === nextMerge.level)?.ratioPower ?? 0

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
      status,
      nextRatioPower,
    })
  }

  return needs.sort((a, b) => a.minerName.localeCompare(b.minerName))
}
