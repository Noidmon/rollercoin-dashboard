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

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
export const PART_TYPES: PartType[] = ['fan', 'wire', 'hashboard']

// Reconhece um texto tipo "Common" ou "epic" (case-insensitive) como Rarity.
// Compartilhado entre os parsers de marketplace e de inventário de peças --
// nenhum dos dois duplica essa lista de raridades/tipos por conta própria.
export function parseRarityLabel(text: string): Rarity | null {
  const normalized = text.trim().toLowerCase()
  return RARITIES.includes(normalized as Rarity) ? (normalized as Rarity) : null
}

export function parseTypeLabel(text: string): PartType | null {
  const normalized = text.trim().toLowerCase()
  return PART_TYPES.includes(normalized as PartType) ? (normalized as PartType) : null
}

const PART_NAME_PATTERN = new RegExp(
  `^(${RARITIES.map((r) => RARITY_LABEL[r]).join('|')}) (${PART_TYPES.map((t) => TYPE_LABEL[t]).join('|')})$`,
  'i',
)

// Reconhece um texto tipo "Epic Fan" (uma linha só, raridade+tipo juntos,
// formato usado no paste do marketplace).
export function parsePartName(text: string): { rarity: Rarity; type: PartType } | null {
  const match = text.match(PART_NAME_PATTERN)
  if (!match) return null
  const rarity = parseRarityLabel(match[1])
  const type = parseTypeLabel(match[2])
  if (!rarity || !type) return null
  return { rarity, type }
}

// A raridade "do nível de merge" como um todo -- na prática quase todo
// merge usa só 1 tipo de peça (fan OU wire OU hashboard); um punhado usa os
// 3 ao mesmo tempo, sempre no mesmo level entre eles. Pega o maior level
// presente, que cobre os dois casos.
export function getMergeLevelRarity(merge: MinerMerge): Rarity | null {
  const level = Math.max(merge.fanLevel, merge.wireLevel, merge.hashboardLevel)
  return levelToRarity(level)
}

export function partImagePath(type: PartType, rarity: Rarity): string {
  return `rollercoin/parts/${type}_${rarity}.webp`
}

export interface ActivePart {
  type: PartType
  rarity: Rarity
  count: number
}

// Peças de fato usadas naquele nível (count > 0) -- normalmente só 1 tipo,
// mas alguns merges usam os 3 ao mesmo tempo. Alguns níveis reais não usam
// NENHUMA peça (os 3 counts zerados) -- confirmado em miners.json (ex:
// Bronze Core nível 4 "Rare -> Epic", requiredPreviousCount 7 -- sim, 7
// mesmo, não é bug de campo trocado -- e nível 6 "Legendary -> Unreal",
// requiredPreviousCount 3, ambos com fan/hashboard/wire zerados). Nesses
// casos getActiveParts retorna [] de propósito e a UI de /merges
// corretamente não mostra nenhuma linha de peça -- não é bug de
// renderização, é o merge exigindo só cópias + taxa RLT.
export function getActiveParts(merge: MinerMerge): ActivePart[] {
  const parts: ActivePart[] = []
  const candidates: [PartType, number, number][] = [
    ['fan', merge.fanCount, merge.fanLevel],
    ['wire', merge.wireCount, merge.wireLevel],
    ['hashboard', merge.hashboardCount, merge.hashboardLevel],
  ]
  for (const [type, count, level] of candidates) {
    if (count <= 0) continue
    const rarity = levelToRarity(level)
    if (rarity) parts.push({ type, rarity, count })
  }
  return parts
}

// Cores exatas extraídas via DevTools (getComputedStyle) do background de
// cada célula da tabela de custos em minaryganar.com/rollercoin/miners/
// goal-rush -- não estimadas visualmente. Nível 7 (raro, ~43 mineradores)
// não tem cor nem ícone de referência (level_7.webp não existe no servidor
// deles, confirmado via curl -> 404): usa um cinza neutro como fallback.
const LEVEL_COLORS: Record<number, string> = {
  2: '#20A300',
  3: '#0B9696',
  4: '#CA27AE',
  5: '#B19500',
  6: '#B50000',
}
const FALLBACK_LEVEL_COLOR = '#475569'

export function getMergeLevelColor(level: number): string {
  return LEVEL_COLORS[level] ?? FALLBACK_LEVEL_COLOR
}

// Nome de raridade do PRÓPRIO MINERADOR ao fundir (fonte: blog oficial
// RollerCoin, Dev Diaries) -- NÃO confundir com a raridade das PEÇAS
// consumidas no merge (LEVEL_TO_RARITY acima), que fica um nível atrás (pra
// chegar em "Uncommon" você gasta peças "Common", etc). Level 0 = base
// (ainda não fundido) = "Common"; nível 7 (raro, sem referência oficial
// confirmada -- mesma ausência de cor/ícone já documentada em LEVEL_COLORS)
// cai no fallback numérico em vez de arriscar um nome errado.
const MINER_LEVEL_RARITY_NAMES: Record<number, string> = {
  0: 'Common',
  2: 'Uncommon',
  3: 'Rare',
  4: 'Epic',
  5: 'Legendary',
  6: 'Unreal',
}

export function getMinerLevelRarityName(level: number): string {
  return MINER_LEVEL_RARITY_NAMES[level] ?? `Nível ${level}`
}

// Limiares fixos (mesmos do aviso "Poder <1.5 por Ph" em /mineradores/:slug)
// -- independente da cor de nível/raridade da linha. Exportado daqui (em vez
// de duplicado) pra ser reaproveitado também no badge de qualidade de
// /merges.
export function getRatioColor(ratio: number): string {
  if (ratio > 3.0) return '#DC2626'
  if (ratio >= 1.5) return '#D97706'
  return '#16A34A'
}

// Exportado -- reaproveitado em /merges pra calcular o custo só das peças
// que faltam no inventário, sem duplicar a lógica de override/fallback.
export function getPartPrice(
  rarity: Rarity,
  type: PartType,
  overridePrices: Record<string, number>,
  craftingPrices: CraftingPrices,
): number {
  const key = partPriceKey(rarity, type)
  const override = overridePrices[key]
  return override !== undefined ? override : craftingPrices[rarity][type]
}

function getPartPriceByLevel(
  type: PartType,
  level: number,
  overridePrices: Record<string, number>,
  craftingPrices: CraftingPrices,
): number {
  const rarity = levelToRarity(level)
  if (!rarity) return 0
  return getPartPrice(rarity, type, overridePrices, craftingPrices)
}

// power dos mineradores/merges vem em Gh/s (mesma convenção de
// formatPower.ts) -- Ph/s = Gh/s ÷ 1_000_000 (Gh->Th->Ph, ÷1000 cada).
function powerGhSToPhS(powerGhS: number): number {
  return powerGhS / 1_000_000
}

// Poder (Gh/s) de um minerador em um nível específico -- 0 = base,
// N = nível de merge. Usado em /merges pra calcular o ganho de poder de uma
// cadeia de merges a partir do nível atual.
export function getMinerPowerAtLevel(miner: Pick<Miner, 'power' | 'merges'>, level: number): number {
  if (level === 0) return miner.power
  return miner.merges.find((mg) => mg.level === level)?.power ?? 0
}

// Mesma lógica de getMinerPowerAtLevel, pro bônus (%) do minerador nesse
// nível -- usado em /merges pra mostrar a linha "bônus atual -> próximo".
export function getMinerBonusAtLevel(miner: Pick<Miner, 'bonus' | 'merges'>, level: number): number {
  if (level === 0) return miner.bonus
  return miner.merges.find((mg) => mg.level === level)?.bonus ?? 0
}

export interface MergeCostRow {
  merge: MinerMerge
  totalPieces: number
  activeParts: ActivePart[]
  piecesCost: number
  mergeFeeCost: number
  piecesPlusFee: number
  finalCost: number
  ratioPower: number
}

// `fromLevel` (opcional) faz a tabela começar a partir de um nível já
// possuído -- usado em /merges pra "Cadeia Completa": as cópias do nível
// `fromLevel` já foram conquistadas (custo 0), e cada passo seguinte
// continua reaproveitando a MESMA fórmula recursiva de finalCost (as cópias
// intermediárias vêm de merges anteriores dentro dessa mesma cadeia, nunca
// de compra avulsa). Omitido (ou 0), o comportamento é idêntico ao de
// /mineradores/:slug -- tabela completa a partir da base.
export function calculateMergeCostTable(
  miner: Pick<Miner, 'merges'>,
  forgeDiscount: number,
  overridePrices: Record<string, number>,
  craftingPrices: CraftingPrices,
  options?: { fromLevel?: number },
): MergeCostRow[] {
  const fromLevel = options?.fromLevel ?? 0
  const sortedMerges = [...miner.merges]
    .filter((mg) => mg.level > fromLevel)
    .sort((a, b) => a.level - b.level)
  const rows: MergeCostRow[] = []
  let previousFinalCost = 0

  for (const merge of sortedMerges) {
    const fanPrice = getPartPriceByLevel('fan', merge.fanLevel, overridePrices, craftingPrices)
    const wirePrice = getPartPriceByLevel('wire', merge.wireLevel, overridePrices, craftingPrices)
    const hashboardPrice = getPartPriceByLevel(
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
      activeParts: getActiveParts(merge),
      piecesCost: piecesCostDiscounted,
      mergeFeeCost: mergeFeeDiscounted,
      piecesPlusFee,
      finalCost,
      ratioPower,
    })
  }

  return rows
}
