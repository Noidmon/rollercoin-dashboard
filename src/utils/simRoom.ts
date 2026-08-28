// Estado de edição manual da sala simulada (Simulador, Fase B/C) -- vive
// junto do Auto-Otimizador (useAutoOptimizer.ts) porque os dois editam o
// MESMO estado: rodar o Auto-Otimizador depois de uma edição manual parte
// do que já foi editado, não do room-config real (pedido explícito do
// usuário). "Simulação" nunca escreve no room-config real -- é sempre um
// clone local, descartável via "Resetar Simulação".
import type { Miner as RoomMinerInstance, Rack } from './calculatePower'
import type { EnrichedMinerEntry } from '../hooks/useMinersInventoryImport'
import { isNameInAnySet, type MinerSetsData } from './minerSets'
import type { PlayerData } from '../context/PlayerContext'

export interface SimRoomState {
  miners: RoomMinerInstance[]
  racks: Rack[]
}

export function cloneSimRoomFromReal(playerData: PlayerData): SimRoomState {
  return {
    miners: structuredClone(playerData.roomConfig.miners),
    racks: structuredClone(playerData.roomConfig.racks),
  }
}

// Constrói um RoomMinerInstance pronto pra entrar em simRoom.miners a
// partir de uma entrada do inventário colado -- MESMA conversão de nível
// já usada em autoOptimizer.ts (buildInventoryCandidates): matchedLevel usa
// a numeração de raridade do catálogo (0,2,3,4,5,6 -- pula o "1"), convertida
// pra convenção 0-indexada de room-config (nº de merges feitos) subtraindo
// 1, exceto no caso base (0 continua 0). `type`/`is_in_set` seguem a mesma
// aproximação documentada lá: sem "type" real vindo do texto colado,
// aproxima como 'merge' quando o nível indica merge (level>0) -- miners
// base (level=0) nunca mostram selo de qualquer forma, então o valor de
// `type` não importa nesse caso.
export function buildMinerFromInventoryEntry(
  entry: EnrichedMinerEntry,
  rackInstanceId: string,
  x: 0 | 1,
  y: number,
  setsData: MinerSetsData | null,
): RoomMinerInstance {
  const level = entry.matchedLevel === 0 ? 0 : entry.matchedLevel - 1
  return {
    _id: `sim-${entry.key}-${rackInstanceId}-${x}-${y}-${Math.random().toString(36).slice(2, 8)}`,
    miner_id: entry.roomDedupMinerId,
    name: entry.name,
    power: entry.power,
    bonus_percent: entry.bonus * 100,
    level,
    type: level > 0 ? 'merge' : undefined,
    is_in_set: setsData ? isNameInAnySet(entry.name, setsData) : undefined,
    placement: { user_rack_id: rackInstanceId, x, y },
    width: entry.cells === 2 ? 2 : 1,
    // Marca explícita de origem (Prompt 75) -- usada por
    // computeRemainingInventory pra só descontar do "restam N" cópias
    // REALMENTE consumidas do inventário nesta sessão (via modal ou
    // drag-and-drop, os dois caminhos que chamam essa função), nunca a
    // base real já instalada desde o clone inicial de simRoom.
    fromInventory: true,
    // Propaga a marca de hipotético (Prompt 76) -- garante que
    // computeRemainingInventory nunca desconte um item hipotético do pool
    // REAL do mesmo nome+nível, e vice-versa.
    isHypothetical: entry.isHypothetical,
  }
}

// Quantas cópias de cada entrada do inventário JÁ estão em uso NESTA
// SESSÃO (colocadas via modal, drag-and-drop, ou Auto-Otimizador) --
// necessário pro seletor de troca do modal não oferecer mais cópias do
// que sobra de fato. Casa por nome+nível (mesma chave usada pelo bônus de
// set, ver minerSets.ts) já que instâncias simuladas não têm um id estável
// que sobreviva a re-renders.
//
// Bug real corrigido (Prompt 75): antes contava QUALQUER minerador de
// simRoom.miners com o mesmo nome+nível, incluindo os que já estavam
// FISICAMENTE instalados na sala desde antes de qualquer edição (simRoom
// começa como clone do room-config real). Isso é semanticamente errado --
// "instalado na sala" e "em storage" (o texto colado) são categorias
// SEPARADAS no jogo real (a mesma peça física nunca está nas duas ao
// mesmo tempo), então um minerador real instalado nunca deveria descontar
// do "quanto sobra no storage colado". Investigação confirmou isso com
// dado real (conta NoID): "La Terreta" e "Crypto Capone" apareciam como
// "restam 0" mesmo com quantidade colada > 0, só porque o MESMO nome+nível
// já estava instalado em algum rack -- uma cópia genuinamente diferente da
// que está no storage, não a mesma sendo contada duas vezes. Corrigido
// filtrando só miners com fromInventory===true (ver calculatePower.ts) --
// a marca explícita de "isso veio do inventário NESTA sessão", setada nos
// 3 pontos que adicionam a simRoom.miners a partir do inventário
// (buildMinerFromInventoryEntry aqui, usado por modal+drag-and-drop; e
// buildFinalMiners em autoOptimizer.ts, via origin==='inventory').
//
// Prompt 76 (itens hipotéticos, modal "+"): a chave de uso agora inclui
// isHypothetical -- um minerador REAL "Bread" e um HIPOTÉTICO "Bread" do
// MESMO nome+nível são pools totalmente separados (nunca descontam um do
// outro), mesmo que fisicamente sejam miners com o mesmo nome/nível
// dentro de simRoom.miners. Sem essa distinção, usar 1 cópia hipotética
// erradamente descontaria do "restam" do item REAL de mesmo nome (ou
// vice-versa).
export function computeRemainingInventory(
  simMiners: RoomMinerInstance[],
  entries: EnrichedMinerEntry[],
): Map<string, number> {
  const usedByNameLevel = new Map<string, number>()
  for (const m of simMiners) {
    if (!m.name || !m.fromInventory) continue
    const key = `${m.name}|${m.level ?? 0}|${m.isHypothetical ? 1 : 0}`
    usedByNameLevel.set(key, (usedByNameLevel.get(key) ?? 0) + 1)
  }

  const remaining = new Map<string, number>()
  for (const entry of entries) {
    const level = entry.matchedLevel === 0 ? 0 : entry.matchedLevel - 1
    const used = usedByNameLevel.get(`${entry.name}|${level}|${entry.isHypothetical ? 1 : 0}`) ?? 0
    remaining.set(entry.key, Math.max(0, entry.quantity - used))
  }
  return remaining
}

function minerAt(miners: RoomMinerInstance[], rackInstanceId: string, x: 0 | 1, y: number): RoomMinerInstance | undefined {
  return miners.find((m) => {
    if (m.placement?.user_rack_id !== rackInstanceId || m.placement?.y !== y) return false
    const mWidth = m.width === 2 ? 2 : 1
    return mWidth === 2 ? true : m.placement.x === x
  })
}

// Remove o(s) minerador(es) ocupando um slot -- largura 2 sempre começa em
// x=0 e ocupa a linha INTEIRA (mesma convenção de autoOptimizer.ts/
// buildRows: um candidato largura 2 só entra numa linha com os DOIS x
// livres), então clicar em x=0 OU x=1 de uma linha ocupada por um
// minerador largura 2 precisa remover essa MESMA instância única.
function removeOccupantsAt(miners: RoomMinerInstance[], rackInstanceId: string, x: 0 | 1, y: number): RoomMinerInstance[] {
  return miners.filter((m) => {
    if (m.placement?.user_rack_id !== rackInstanceId || m.placement?.y !== y) return true
    const mWidth = m.width === 2 ? 2 : 1
    if (mWidth === 2) return false
    return m.placement.x !== x
  })
}

// Bug real corrigido (Prompt 72): um minerador largura-2 SEMPRE começa em
// x=0 e ocupa a linha inteira (mesma convenção usada em toda parte --
// buildRows/autoOptimizer.ts, listRackSlots acima). Se a entrada escolhida
// no seletor for largura-2, normaliza pra x=0 e limpa AS DUAS posições da
// linha (0 e 1), mesmo que o clique original tenha sido no slot x=1 do
// par -- sem isso, um largura-2 colocado com x=1 ficava com posição
// inconsistente (listRackSlots só detecta largura-2 checando x=0, então
// nunca reconheceria essa instância como "ocupa a linha inteira" de
// volta, quebrando o render e a contagem de slots).
export function swapMinerInSim(
  state: SimRoomState,
  rackInstanceId: string,
  x: 0 | 1,
  y: number,
  entry: EnrichedMinerEntry,
  setsData: MinerSetsData | null,
): SimRoomState {
  const isWide = entry.cells === 2
  const targetX: 0 | 1 = isWide ? 0 : x
  const withoutOccupant = isWide
    ? removeOccupantsAt(removeOccupantsAt(state.miners, rackInstanceId, 0, y), rackInstanceId, 1, y)
    : removeOccupantsAt(state.miners, rackInstanceId, x, y)
  const newMiner = buildMinerFromInventoryEntry(entry, rackInstanceId, targetX, y, setsData)
  return { ...state, miners: [...withoutOccupant, newMiner] }
}

export function removeMinerFromSim(state: SimRoomState, rackInstanceId: string, x: 0 | 1, y: number): SimRoomState {
  return { ...state, miners: removeOccupantsAt(state.miners, rackInstanceId, x, y) }
}

export function dismountRackMinersInSim(state: SimRoomState, rackInstanceId: string): SimRoomState {
  return { ...state, miners: state.miners.filter((m) => m.placement?.user_rack_id !== rackInstanceId) }
}

export function dismountRackInSim(state: SimRoomState, rackInstanceId: string): SimRoomState {
  return {
    miners: state.miners.filter((m) => m.placement?.user_rack_id !== rackInstanceId),
    racks: state.racks.filter((r) => r._id !== rackInstanceId),
  }
}

export interface RackSlotView {
  x: 0 | 1
  y: number
  spansBothX: boolean
  occupant: RoomMinerInstance | null
}

// Lista TODOS os slots físicos de uma rack (uma linha por y, sempre com 2
// posições x=[0,1] -- confirmado em buildRows/autoOptimizer.ts, `rack_info.
// width` do catálogo não limita quantos x cabem por linha, só afeta o
// desenho da rack). Um minerador largura 2 ocupa a linha inteira -- vira 1
// entrada só (spansBothX=true) em vez de duas.
export function listRackSlots(miners: RoomMinerInstance[], rackInstanceId: string, heightCells: number): RackSlotView[] {
  const slots: RackSlotView[] = []
  for (let y = 0; y < heightCells; y++) {
    const wide = minerAt(miners, rackInstanceId, 0, y)
    if (wide && (wide.width === 2)) {
      slots.push({ x: 0, y, spansBothX: true, occupant: wide })
      continue
    }
    slots.push({ x: 0, y, spansBothX: false, occupant: minerAt(miners, rackInstanceId, 0, y) ?? null })
    slots.push({ x: 1, y, spansBothX: false, occupant: minerAt(miners, rackInstanceId, 1, y) ?? null })
  }
  return slots
}

// Compatibilidade de largura de UM slot -- usada tanto pelo seletor de
// troca do modal (SimRackModal.tsx) quanto pelo drag-and-drop do
// inventário (Prompt 73, RoomRacksLayer.tsx), pra nunca duplicar essa
// regra em dois lugares. Um slot já ocupado por largura-2 (spansBothX)
// aceita qualquer largura na troca (substituição direta). Um slot vazio
// só aceita largura-2 se a célula VIZINHA (mesma linha, outro x) também
// estiver vazia -- caso contrário, só largura-1. Um slot OCUPADO por
// largura-1 nunca aceita largura-2 aqui (trocar um largura-1 por um
// largura-2 exigiria invadir a vizinha mesmo que ela esteja livre --
// fora de escopo, mesma limitação documentada desde o modal).
export function cellsAllowedForSlot(slots: RackSlotView[], slot: RackSlotView): 1 | 2 | 'any' {
  if (slot.spansBothX) return 'any'
  if (slot.occupant) return 1
  const sibling = slots.find((s) => s.y === slot.y && s.x !== slot.x)
  const pairFullyEmpty = !sibling || !sibling.occupant
  return pairFullyEmpty ? 'any' : 1
}

export { minerAt }
