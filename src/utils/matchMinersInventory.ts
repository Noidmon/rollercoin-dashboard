import type { Miner } from '../types/miner'
import type { MinerInventoryEntry } from './parseMinersInventory'
import type { Miner as RoomMinerInstance } from './calculatePower'

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

// Confirmado byte a byte comparando miners.json com o texto colado real:
// nomes com "’" (U+2019, aspa curva) ou "–" (U+2013, travessão) em
// miners.json aparecem como "â" (U+00E2) no texto colado -- mojibake
// clássico (o byte UTF-8 0xE2, primeiro byte de qualquer caractere de
// pontuação especial U+20xx, sobrevive sozinho e vira "â" quando
// reinterpretado como Latin-1/Windows-1252, e os bytes seguintes se
// perdem). Confirmado que nenhum dos 1673 mineradores usa "â" de verdade
// no nome, e miners.json é inconsistente (mistura aspa reta ' e curva ’
// em nomes diferentes) -- então normaliza removendo os três (aspa reta,
// aspa curva, travessão) e o artefato "â" dos dois lados antes de
// comparar. NÃO remove hífen comum '-' -- isso causaria uma colisão real
// (“Banana” e “Ba-na-na” virariam o mesmo nome), e nenhum caso real
// precisa disso (travessão U+2013 é um código diferente de hífen U+002D).
function normalizeMinerName(name: string): string {
  return name
    .replace(/[‘’–—â']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function buildMinersByNormalizedNameMap(miners: Miner[]): Map<string, Miner> {
  const map = new Map<string, Miner>()
  for (const m of miners) map.set(normalizeMinerName(m.name), m)
  return map
}

// Núcleo do casamento nome+power reaproveitado tanto por matchMinersInventory
// (agrega em quantidade) quanto por matchRoomMinerInstances (preserva cada
// instância física da sala) -- mesma tolerância de 0.5%, mesma normalização
// de nome, sem duplicar a lógica entre os dois.
export function resolveMinerLevel(
  name: string,
  powerValue: number,
  minersByNormalizedName: Map<string, Miner>,
): { miner: Miner; matchedLevel: number } | null {
  const miner = minersByNormalizedName.get(normalizeMinerName(name))
  if (!miner) return null

  if (powersMatch(powerValue, miner.power)) return { miner, matchedLevel: 0 }

  const mergeMatch = miner.merges.find((mg) => powersMatch(powerValue, mg.power))
  return mergeMatch ? { miner, matchedLevel: mergeMatch.level } : null
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
  const minersByNormalizedName = buildMinersByNormalizedNameMap(miners)

  for (const entry of entries) {
    const resolved = resolveMinerLevel(entry.name, entry.powerValue, minersByNormalizedName)
    if (!resolved) {
      unrecognized.push(entry)
      continue
    }

    matched.push({
      name: entry.name,
      quantity: entry.quantity,
      sellable: entry.sellable,
      matchedLevel: resolved.matchedLevel,
    })
  }

  return { matched, unrecognized }
}

export interface ResolvedRoomMinerInstance {
  // Objeto ORIGINAL da sala (mesma referência, com _id/miner_id/placement
  // intactos) -- preservado de propósito, sem agregar em quantidade, porque
  // o "Impacto Real na Sala" de /merges precisa saber EXATAMENTE quais
  // cópias físicas remover (e em qual rack) pra simular um merge.
  instance: RoomMinerInstance
  minerId: string // id do minerador em miners.json -- NÃO o miner_id da sala
  minerName: string
  matchedLevel: number
}

// Casa cada INSTÂNCIA individual de room-config (sem agregar) contra
// miners.json -- reaproveita resolveMinerLevel em vez de duplicar a lógica
// de tolerância/normalização já usada em matchMinersInventory.
export function matchRoomMinerInstances(
  roomMiners: RoomMinerInstance[],
  miners: Miner[],
): ResolvedRoomMinerInstance[] {
  const minersByNormalizedName = buildMinersByNormalizedNameMap(miners)
  const resolved: ResolvedRoomMinerInstance[] = []

  for (const instance of roomMiners) {
    if (!instance.name) continue
    const match = resolveMinerLevel(instance.name, instance.power, minersByNormalizedName)
    if (!match) continue
    resolved.push({
      instance,
      minerId: match.miner.id,
      minerName: match.miner.name,
      matchedLevel: match.matchedLevel,
    })
  }

  return resolved
}
