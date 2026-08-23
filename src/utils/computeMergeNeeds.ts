import type { Miner, MinerMerge } from '../types/miner'
import type { MatchedMinerEntry } from './matchMinersInventory'
import type { PartInventoryEntry } from './parsePartsInventory'
import {
  calculateMergeCostTable,
  getActiveParts,
  getMinerBonusAtLevel,
  getMinerPowerAtLevel,
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
  // Poder/bônus do nível atual e do próximo (miners.json) -- pra linha
  // "atual -> próximo" no card e pra ordenação por Poder/Bônus.
  currentPower: number
  nextPower: number
  currentBonus: number
  nextBonus: number
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

// Quantas cópias o jogador tem de cada minerador em cada nível (sala +
// inventário colado, já somados antes de chegar aqui) -- chave
// "{nome}::{nível}". Exportado (em vez de ficar só dentro de
// computeMergeNeeds) pra ser reaproveitado em /merges no aviso "você já tem
// X do nível resultante", sem duplicar a mesma agregação por nome+nível.
export function buildOwnedByNameLevelMap(ownedEntries: MatchedMinerEntry[]): Map<string, number> {
  const ownedByNameLevel = new Map<string, number>()
  for (const entry of ownedEntries) {
    const key = `${entry.name}::${entry.matchedLevel}`
    ownedByNameLevel.set(key, (ownedByNameLevel.get(key) ?? 0) + entry.quantity)
  }
  return ownedByNameLevel
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
  // Poder/bônus de origem (fromLevel) e bônus de destino (toLevel) desse
  // passo específico -- power (acima) já é o de destino. Usado pra linha
  // local "atual -> próximo" de cada passo da Cadeia Completa.
  fromPower: number
  fromBonus: number
  bonus: number
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

// Simula subir a cadeia de merge de um minerador usando as cópias que o
// jogador já possui -- reaproveita calculateMergeCostTable (mesma fórmula
// recursiva de finalCost/ratioPower) e, pra cada passo, deriva quantas
// cópias do próximo nível resultariam de mesclar as cópias disponíveis em
// grupos de requiredPreviousCount (igual à conta já feita internamente por
// finalCost, só que aplicada a CONTAGEM em vez de custo).
//
// Em CADA nível alcançado, a quantidade disponível soma (cópias produzidas
// pelos merges anteriores da própria simulação) + (cópias que o jogador JÁ
// possuía originalmente naquele nível, via ownedByNameLevel -- sala +
// colado) -- bug real corrigido aqui: antes só a cascata contava, então um
// jogador com 2 Epic (produz 1 Legendary) E 1 Legendary já possuído
// separadamente parava em "Epic -> Legendary (máximo)" mesmo tendo, na
// prática, 1+1=2 Legendary -- o suficiente pra também fazer
// Legendary -> Unreal.
export function simulateMergeChain(
  miner: Miner,
  currentLevel: number,
  ownedAtCurrentLevel: number,
  ownedByNameLevel: Map<string, number>,
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

  // copies carrega só o que a cascata simulada PRODUZIU até aqui -- o que
  // o jogador já possuía de verdade em cada nível é somado separadamente a
  // cada passo (via ownedByNameLevel), nunca duplicado: pro primeiro passo
  // (fromLevel = currentLevel), copies começa em 0 e ownedAtCurrentLevel é
  // somado abaixo como qualquer outro nível -- não fica pré-somado aqui.
  let copies = 0
  let reachedLevel = currentLevel
  // Cópias que sobram SEM CONVERTER no nível efetivamente alcançado --
  // separado de `copies` (que seria zerado por qualquer passo seguinte que
  // falhe, mesmo depois do ponto real de alcance, já que agora um passo
  // pode falhar no meio e um passo POSTERIOR ainda ter sucesso graças a
  // cópias extras já possuídas naquele nível -- ver comentário acima).
  let leftoverAtReachedLevel = 0
  let totalMerges = 0
  let totalFeeCost = 0
  const steps: ChainStepDetail[] = []

  for (let i = 0; i < sortedMerges.length; i++) {
    const merge = sortedMerges[i]
    const row = costTable[i]
    const fromLevel = i === 0 ? currentLevel : sortedMerges[i - 1].level
    const ownedAtFromLevel =
      i === 0 ? ownedAtCurrentLevel : (ownedByNameLevel.get(`${miner.name}::${fromLevel}`) ?? 0)
    const availableCopies = copies + ownedAtFromLevel
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
      fromPower: getMinerPowerAtLevel(miner, fromLevel),
      fromBonus: getMinerBonusAtLevel(miner, fromLevel),
      bonus: merge.bonus,
    })

    if (mergesPerformed > 0) {
      reachedLevel = merge.level
      leftoverAtReachedLevel = mergesPerformed
      totalMerges += mergesPerformed
      totalFeeCost += mergesPerformed * row.mergeFeeCost
    }
    copies = mergesPerformed
  }

  return { steps, reachedLevel, totalMerges, totalFeeCost, leftoverCopies: leftoverAtReachedLevel }
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
  const ownedByNameLevel = buildOwnedByNameLevelMap(ownedEntries)

  // nível MÍNIMO possuído de cada minerador -- é a partir dele que o
  // PRÓXIMO merge acionável deve ser calculado. Um jogador pode ter cópias
  // em vários níveis ao mesmo tempo (ex: 2 em Rare, 1 em Epic, 1 em
  // Legendary) -- usar o nível MÁXIMO possuído ignorava fusões já prontas
  // em níveis mais baixos (bug real: só aparecia "Legendary -> Unreal
  // 1/2", nunca o "Rare -> Epic 2/2" já pronto). Usar o mínimo resolve o
  // elo mais fraco/gargalo mais cedo da cadeia primeiro, respeitando a
  // ordem natural de progressão -- a Cadeia Completa expandida continua
  // cobrindo os níveis mais altos depois, então nenhuma informação se
  // perde, só a ordem de exibição do "próximo passo principal" muda.
  const minLevelByName = new Map<string, number>()
  for (const entry of ownedEntries) {
    const current = minLevelByName.get(entry.name)
    if (current === undefined || entry.matchedLevel < current) {
      minLevelByName.set(entry.name, entry.matchedLevel)
    }
  }

  const partsOwned = buildPartsOwnedMap(partsInventory)

  const needs: MergeNeed[] = []

  for (const [name, currentLevel] of minLevelByName) {
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
      currentPower: getMinerPowerAtLevel(miner, currentLevel),
      nextPower: nextMerge.power,
      currentBonus: getMinerBonusAtLevel(miner, currentLevel),
      nextBonus: nextMerge.bonus,
    })
  }

  return needs.sort((a, b) => a.minerName.localeCompare(b.minerName))
}
