// Auto-Otimizador (Simulador, Fase B) -- distribui os mineradores do
// inventário JÁ IMPORTADO (painel colado) nos racks da sala, maximizando
// "poder da sala sem temporário" (miners + bônus de coleção dedup por
// tipo/nível + bônus de rack), respeitando um teto de poder por liga.
// Nunca sugere comprar nada -- só reorganiza o que a pessoa já possui, e é
// sempre PREVIEW local (nunca persiste, nunca altera o room-config real).
//
// Reaproveita SEM MODIFICAR calculateRoomPower/sumUniqueMinerBonusPercent
// (calculatePower.ts) -- o mesmo motor já usado por "Impacto Real na Sala"
// em Merges.tsx (computeRoomMergeImpact). Confirmado antes de implementar
// (investigação prévia, Prompt 64): calculateRoomPower's total INCLUI
// gamesPower e temp nos parâmetros -- não são excluídos automaticamente
// pela função. O padrão já estabelecido (computeRoomMergeImpact) pra obter
// "poder sem temporário" é chamar com gamesPower=0 e temp=0 -- quando os
// dois são 0, a fórmula se reduz exatamente a
// minersTotal + racksTotal + minersTotal*bonusPercent/10000, que É a
// definição confirmada pelo usuário (games/freon/hamster nunca entram).
// Aqui usamos SEMPRE gamesPower=0, temp=0, e bonusPercent = dedup fresco
// sobre os miners da sala CANDIDATA (sem o conceito de "externalFixedBonus"
// usado em computeRoomMergeImpact -- lá isso isola a mudança de UM merge
// contra uma sala real; aqui calculamos um total absoluto autocontido pra
// cada configuração candidata, então recalcular o dedup direto é mais
// simples e igualmente correto).
//
// Arquitetura (Prompt 64, revisada durante os próprios testes): os DOIS
// modos partem do MESMO ponto -- todo instalado na própria posição
// original (placeInstalledAtOriginalPositions) + inventário preenchendo os
// slots vazios remanescentes (runPoderBruto/runPadrao). Preservar sala para
// exatamente aí. Máximo poder roda um passo extra de TROCA (runSwapPass)
// em cima desse resultado, tentando substituir o instalado mais fraco pelo
// candidato de inventário mais forte ainda não colocado, validando cada
// troca com um recálculo REAL (não o tracker incremental) antes de aceitar.
//
// Isso substitui o design original (tratar TODO instalado como candidato
// comum, competindo do zero junto com o inventário) -- descartado depois
// de confirmar com dado real (conta NoID, bônus de coleção real ~3164%)
// que começar do zero faz a heurística gulosa gastar o "orçamento" de
// bônus cedo demais em poucos tipos de alto bônus (bônus de coleção
// multiplica o poder TOTAL, então cada tipo novo encarece
// desproporcionalmente as adições seguintes) e travar no teto antes de
// sequer conseguir recolocar de volta todo mundo que já estava instalado --
// mesmo quando o total de TODOS eles juntos, sem tocar em nada, já coubesse
// folgado no teto escolhido. Partir da posição original elimina esse
// problema por construção: reconstituir a sala como já estava nunca custa
// nada (já é onde cada um está), e só o que REALMENTE precisa de uma
// decisão (o que fazer com os slots vazios, e -- só no Máximo poder -- se
// vale trocar algum instalado fraco) passa pela heurística.
import {
  calculateRoomPower,
  sumUniqueMinerBonusPercent,
  type Miner as RoomMinerInstance,
  type Rack,
} from './calculatePower'
import { roomConfigToRackPlacements } from './roomLayout'
import type { EnrichedMinerEntry } from '../hooks/useMinersInventoryImport'

export type OptimizerPriority = 'padrao' | 'poder_bruto'
export type OptimizerMode = 'maximo_poder' | 'preservar_sala'

// Uma "cópia" candidata a ser posicionada -- 1 unidade física (célula de
// inventário expande em várias cópias idênticas até o limite de `quantity`
// ou do espaço físico disponível, o que for menor).
interface Candidate {
  groupKey: string // agrupa cópias IDÊNTICAS (mesmo tipo+nível) pra Padrão avaliar 1x por grupo, não por cópia
  instanceKey: string // única por cópia física (usada no relatório final)
  roomDedupMinerId: string
  name: string
  power: number
  bonusPercent: number // convenção nativa de room-config (centésimos de %)
  cells: 1 | 2
  image: string | null
  origin: 'installed' | 'inventory'
  // Só presente pra origin==='installed' -- posição ORIGINAL real, usada
  // pra detectar "ficou onde estava" (Preservar sala sempre, Máximo poder
  // às vezes por coincidência) e pra listar "removidos".
  originalPosition?: { rackInstanceId: string; y: number }
}

interface CandidateGroup {
  groupKey: string
  roomDedupMinerId: string
  name: string
  power: number
  bonusPercent: number
  cells: 1 | 2
  image: string | null
  origin: 'installed' | 'inventory'
  copies: Candidate[] // cópias físicas ainda não colocadas, na ordem em que devem ser consumidas
}

interface WorkingRow {
  rackInstanceId: string
  rackName: string
  roomLevel: number
  y: number
  rackBonus: number
  freeXs: (0 | 1)[] // posições x ainda livres nessa linha -- [0,1] vazia, [0] ou [1] parcial, [] cheia
}

export interface OptimizerPlacement {
  instanceKey: string
  roomDedupMinerId: string
  name: string
  power: number
  // Convenção nativa de room-config (centésimos de %) -- precisa ir junto
  // pra buildFinalMiners conseguir reconstruir um Miner completo (com
  // bonus_percent de verdade, não 0) na hora de recalcular o total final
  // via calculateRoomPower/sumUniqueMinerBonusPercent.
  bonusPercent: number
  cells: 1 | 2
  image: string | null
  origin: 'installed' | 'inventory'
  rackInstanceId: string
  rackName: string
  roomLevel: number
  y: number
  x: 0 | 1
  // true quando é um minerador instalado que ficou EXATAMENTE onde já
  // estava (mesmo rack+linha) -- filtrado da lista de "mudanças" na UI,
  // mas mantido aqui pra reconstruir a sala final completa.
  unchanged: boolean
}

export interface OptimizerRemoved {
  instanceKey: string
  name: string
  power: number
}

export interface OptimizerEmptySlot {
  rackInstanceId: string
  rackName: string
  roomLevel: number
  y: number
  x: 0 | 1
  reason: 'sem_orcamento' | 'sem_candidato_compativel'
}

export interface AutoOptimizerResult {
  beforeTotal: number
  afterTotal: number
  placements: OptimizerPlacement[]
  removedInstalled: OptimizerRemoved[]
  emptySlots: OptimizerEmptySlot[]
}

export interface AutoOptimizerInput {
  mode: OptimizerMode
  priority: OptimizerPriority
  ceilingGhs: number
  installedMiners: RoomMinerInstance[]
  racks: Rack[]
  inventory: EnrichedMinerEntry[]
}

// Tracker incremental do MESMO formato de calculateRoomPower (gamesPower=0,
// temp=0) -- usado só durante a busca gulosa, pra avaliar milhares de
// combinações candidato×slot em O(1) cada em vez de re-somar a sala
// inteira a cada tentativa. Os totais FINAIS exibidos ao usuário nunca vêm
// daqui -- vêm de uma chamada direta a calculateRoomPower sobre o array de
// miners final (ver totalPowerNoTemp), garantindo que o número mostrado
// bate exatamente com a função canônica.
class RoomPowerTracker {
  minersTotal = 0
  racksTotal = 0
  private bonusByDedupId = new Map<string, number>()

  private get bonusSum(): number {
    let sum = 0
    for (const v of this.bonusByDedupId.values()) sum += v
    return sum
  }

  get total(): number {
    return this.minersTotal + this.racksTotal + (this.minersTotal * this.bonusSum) / 10000
  }

  seed(dedupId: string, bonusPercent: number, power: number, rackBonus: number) {
    this.minersTotal += power
    this.racksTotal += (power * rackBonus) / 10000
    if (!this.bonusByDedupId.has(dedupId)) this.bonusByDedupId.set(dedupId, bonusPercent)
  }

  previewGain(dedupId: string, bonusPercent: number, power: number, rackBonus: number): number {
    const newMinersTotal = this.minersTotal + power
    const newRacksTotal = this.racksTotal + (power * rackBonus) / 10000
    const newBonusSum = this.bonusByDedupId.has(dedupId) ? this.bonusSum : this.bonusSum + bonusPercent
    const newTotal = newMinersTotal + newRacksTotal + (newMinersTotal * newBonusSum) / 10000
    return newTotal - this.total
  }

  commit(dedupId: string, bonusPercent: number, power: number, rackBonus: number) {
    this.seed(dedupId, bonusPercent, power, rackBonus)
  }

  clone(): RoomPowerTracker {
    const copy = new RoomPowerTracker()
    copy.minersTotal = this.minersTotal
    copy.racksTotal = this.racksTotal
    copy.bonusByDedupId = new Map(this.bonusByDedupId)
    return copy
  }
}

function buildRows(racks: Rack[]): WorkingRow[] {
  const placements = roomConfigToRackPlacements({ racks })
  const rackBonusById = new Map(racks.map((r) => [r._id, r.bonus]))
  const rows: WorkingRow[] = []
  for (const p of placements) {
    const rackBonus = rackBonusById.get(p.instanceId) ?? 0
    for (let y = 0; y < p.heightCells; y++) {
      rows.push({
        rackInstanceId: p.instanceId,
        rackName: p.name,
        roomLevel: p.roomLevel,
        y,
        rackBonus,
        freeXs: [0, 1],
      })
    }
  }
  // Ordem determinística (nível, rack, linha) -- usada tanto pra iteração
  // do Poder Bruto quanto como critério de desempate estável no Padrão.
  rows.sort((a, b) => a.roomLevel - b.roomLevel || a.rackInstanceId.localeCompare(b.rackInstanceId) || a.y - b.y)
  return rows
}

function widthOf(width: number | undefined): 1 | 2 {
  return width === 2 ? 2 : 1
}

function hasValidPlacement(m: RoomMinerInstance): boolean {
  return !!m.placement?.user_rack_id && m.placement?.y !== undefined
}

// Coloca cada instalado na PRÓPRIA linha original (sempre compatível, é
// onde já está) -- ocupa as linhas e alimenta o tracker, E devolve os
// registros de OptimizerPlacement (origin='installed', unchanged=true).
// Usado como ponto de partida comum dos dois modos -- no modo Preservar
// sala esses placements nunca são tocados depois; no modo Máximo poder
// eles ficam sujeitos à troca no passo de swap (runSwapPass).
function placeInstalledAtOriginalPositions(
  rows: WorkingRow[],
  installedWithPlacement: RoomMinerInstance[],
  tracker: RoomPowerTracker,
): OptimizerPlacement[] {
  const rowByKey = new Map(rows.map((r) => [`${r.rackInstanceId}:${r.y}`, r]))
  const placements: OptimizerPlacement[] = []

  installedWithPlacement.forEach((m, index) => {
    const row = rowByKey.get(`${m.placement!.user_rack_id}:${m.placement!.y}`)
    if (!row) return

    const cells = widthOf(m.width)
    const x: 0 | 1 = m.placement?.x === 1 ? 1 : 0
    if (cells === 2) {
      row.freeXs = []
    } else {
      row.freeXs = row.freeXs.filter((fx) => fx !== x)
    }

    const dedupId = m.miner_id ?? m._id ?? ''
    tracker.seed(dedupId, m.bonus_percent ?? 0, m.power, row.rackBonus)

    placements.push({
      instanceKey: m._id ?? `installed-${index}`,
      roomDedupMinerId: dedupId,
      name: m.name ?? '?',
      power: m.power,
      bonusPercent: m.bonus_percent ?? 0,
      cells,
      image: null,
      origin: 'installed',
      rackInstanceId: row.rackInstanceId,
      rackName: row.rackName,
      roomLevel: row.roomLevel,
      y: row.y,
      x,
      unchanged: true,
    })
  })

  return placements
}

// Expande cada entrada do inventário em até `quantity` cópias idênticas,
// capado pelo total de células físicas disponíveis (nunca precisamos de
// mais cópias do que cabe fisicamente na sala inteira).
function buildInventoryCandidates(inventory: EnrichedMinerEntry[], totalFreeCells: number): Candidate[] {
  const candidates: Candidate[] = []
  let cellsUsedSoFar = 0

  for (const entry of inventory) {
    const cells = entry.cells === 2 ? 2 : 1
    const maxCopiesByCells = Math.floor((totalFreeCells - cellsUsedSoFar) / cells)
    const copies = Math.max(0, Math.min(entry.quantity, maxCopiesByCells))

    for (let i = 0; i < copies; i++) {
      candidates.push({
        groupKey: `inventory:${entry.key}`,
        instanceKey: `${entry.key}-copy${i}`,
        roomDedupMinerId: entry.roomDedupMinerId,
        name: entry.name,
        power: entry.power,
        bonusPercent: entry.bonus * 100, // catálogo (%) -> convenção room-config (centésimos de %)
        cells,
        image: entry.image,
        origin: 'inventory' as const,
      })
      cellsUsedSoFar += cells
    }
    if (cellsUsedSoFar >= totalFreeCells) break
  }

  return candidates
}

function groupCandidates(candidates: Candidate[]): CandidateGroup[] {
  const groups = new Map<string, CandidateGroup>()
  for (const c of candidates) {
    let group = groups.get(c.groupKey)
    if (!group) {
      group = {
        groupKey: c.groupKey,
        roomDedupMinerId: c.roomDedupMinerId,
        name: c.name,
        power: c.power,
        bonusPercent: c.bonusPercent,
        cells: c.cells,
        image: c.image,
        origin: c.origin,
        copies: [],
      }
      groups.set(c.groupKey, group)
    }
    group.copies.push(c)
  }
  return [...groups.values()]
}

function cloneRows(rows: WorkingRow[]): WorkingRow[] {
  return rows.map((r) => ({ ...r, freeXs: [...r.freeXs] }))
}

function placementFromCandidate(candidate: Candidate, row: WorkingRow, x: 0 | 1): OptimizerPlacement {
  const unchanged =
    candidate.origin === 'installed' &&
    candidate.originalPosition?.rackInstanceId === row.rackInstanceId &&
    candidate.originalPosition?.y === row.y

  return {
    instanceKey: candidate.instanceKey,
    roomDedupMinerId: candidate.roomDedupMinerId,
    name: candidate.name,
    power: candidate.power,
    bonusPercent: candidate.bonusPercent,
    cells: candidate.cells,
    image: candidate.image,
    origin: candidate.origin,
    rackInstanceId: row.rackInstanceId,
    rackName: row.rackName,
    roomLevel: row.roomLevel,
    y: row.y,
    x,
    unchanged,
  }
}

function takeFreeX(row: WorkingRow, cells: 1 | 2): 0 | 1 {
  if (cells === 2) {
    row.freeXs = []
    return 0
  }
  return row.freeXs.shift()!
}

// Prioridade "Poder Bruto": ordena candidatos só por poder-base
// descendente, preenche a primeira linha compatível que não estoure o
// teto (tenta a próxima linha compatível se a primeira estourar -- racks
// diferentes têm bônus diferentes, então uma linha "mais cara" pode
// estourar enquanto outra do mesmo tamanho não estoura).
function runPoderBruto(
  rows: WorkingRow[],
  candidates: Candidate[],
  ceilingGhs: number,
  tracker: RoomPowerTracker,
): OptimizerPlacement[] {
  const sorted = [...candidates]
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.power - a.c.power || a.i - b.i)
    .map(({ c }) => c)

  const placements: OptimizerPlacement[] = []

  for (const candidate of sorted) {
    for (const row of rows) {
      if (row.freeXs.length < candidate.cells) continue
      if (candidate.cells === 2 && row.freeXs.length !== 2) continue

      const gain = tracker.previewGain(candidate.roomDedupMinerId, candidate.bonusPercent, candidate.power, row.rackBonus)
      if (tracker.total + gain > ceilingGhs) continue

      const x = takeFreeX(row, candidate.cells)
      tracker.commit(candidate.roomDedupMinerId, candidate.bonusPercent, candidate.power, row.rackBonus)
      placements.push(placementFromCandidate(candidate, row, x))
      break
    }
  }

  return placements
}

// Prioridade "Padrão": a cada passo, entre TODOS os pares (grupo de
// candidato distinto × linha compatível) ainda viáveis (sem estourar o
// teto), escolhe o que mais aumenta o poder TOTAL da sala (considerando
// bônus de coleção + bônus de rack daquela linha específica), não só o
// poder-base isolado. Repete até não sobrar par viável. Heurística gulosa
// (não é garantidamente ótima global), mas sempre >= Poder Bruto no total
// final por construção (ver runOptimizer -- usa Poder Bruto como piso e
// devolve o melhor dos dois).
function runPadrao(
  rows: WorkingRow[],
  candidates: Candidate[],
  ceilingGhs: number,
  tracker: RoomPowerTracker,
): OptimizerPlacement[] {
  const groups = groupCandidates(candidates)
  const placements: OptimizerPlacement[] = []

  for (;;) {
    let best: { group: CandidateGroup; row: WorkingRow; gain: number } | null = null

    for (const group of groups) {
      if (group.copies.length === 0) continue
      for (const row of rows) {
        if (row.freeXs.length < group.cells) continue
        if (group.cells === 2 && row.freeXs.length !== 2) continue

        const gain = tracker.previewGain(group.roomDedupMinerId, group.bonusPercent, group.power, row.rackBonus)
        if (tracker.total + gain > ceilingGhs) continue

        if (!best || gain > best.gain) best = { group, row, gain }
      }
    }

    if (!best) break

    const candidate = best.group.copies.shift()!
    const x = takeFreeX(best.row, best.group.cells)
    tracker.commit(candidate.roomDedupMinerId, candidate.bonusPercent, candidate.power, best.row.rackBonus)
    placements.push(placementFromCandidate(candidate, best.row, x))
  }

  return placements
}

function buildFinalMiners(placements: OptimizerPlacement[]): RoomMinerInstance[] {
  return placements.map((p) => ({
    _id: p.instanceKey,
    miner_id: p.roomDedupMinerId,
    name: p.name,
    power: p.power,
    bonus_percent: p.bonusPercent,
    placement: { user_rack_id: p.rackInstanceId, x: p.x, y: p.y },
    width: p.cells,
  }))
}

function totalPowerNoTemp(miners: RoomMinerInstance[], racks: Rack[]): number {
  const bonusPercent = sumUniqueMinerBonusPercent(miners)
  return calculateRoomPower(miners, racks, 0, bonusPercent, 0).total
}

function placementFromInventoryCandidateAt(candidate: Candidate, at: OptimizerPlacement): OptimizerPlacement {
  return {
    instanceKey: candidate.instanceKey,
    roomDedupMinerId: candidate.roomDedupMinerId,
    name: candidate.name,
    power: candidate.power,
    bonusPercent: candidate.bonusPercent,
    cells: candidate.cells,
    image: candidate.image,
    origin: 'inventory',
    rackInstanceId: at.rackInstanceId,
    rackName: at.rackName,
    roomLevel: at.roomLevel,
    y: at.y,
    x: at.x,
    unchanged: false,
  }
}

// Passo de troca, só pro modo Máximo poder -- roda DEPOIS de preencher os
// slots vazios com o inventário (igual ao Preservar sala até esse ponto).
// Sem isso, uma sala já 100% cheia (ou com bônus de coleção já muito alto)
// nunca teria como melhorar no modo Máximo poder, mesmo quando trocar um
// instalado fraco por um candidato forte do inventário claramente
// compensaria -- confirmado com dado real da conta NoID (sala 100%
// ocupada, bônus de coleção real ~3164%) durante os testes (Prompt 64).
//
// Busca gulosa limitada (não exaustiva): a cada rodada, tenta parear o
// instalado MAIS FRACO ainda colocado com o candidato do inventário MAIS
// FORTE ainda não colocado, do MESMO tamanho de célula -- valida a troca
// com um recálculo REAL (calculateRoomPower, não o tracker incremental)
// antes de aceitar, garantindo que nunca ultrapassa o teto e (na
// prioridade Padrão) que o total realmente melhora, não só o poder bruto
// da peça isolada. Repete até não sobrar troca válida.
function runSwapPass(
  placements: OptimizerPlacement[],
  remainingInventory: Candidate[],
  racks: Rack[],
  ceilingGhs: number,
  priority: OptimizerPriority,
): OptimizerPlacement[] {
  let current = [...placements]
  let remaining = [...remainingInventory]

  for (;;) {
    const removableInstalled = current.filter((p) => p.origin === 'installed').sort((a, b) => a.power - b.power)
    if (removableInstalled.length === 0 || remaining.length === 0) break

    const addableByCells = new Map<1 | 2, Candidate[]>()
    for (const c of remaining) {
      const list = addableByCells.get(c.cells) ?? []
      list.push(c)
      addableByCells.set(c.cells, list)
    }
    for (const list of addableByCells.values()) list.sort((a, b) => b.power - a.power)

    const currentTotal = totalPowerNoTemp(buildFinalMiners(current), racks)

    let best: { oldP: OptimizerPlacement; newC: Candidate; newTotal: number } | null = null

    for (const oldP of removableInstalled) {
      const newC = addableByCells.get(oldP.cells)?.[0]
      if (!newC) continue

      // Filtro rápido antes do recálculo caro: na prioridade Poder Bruto a
      // troca só faz sentido se o poder BRUTO da peça nova é maior (regra
      // consistente com o resto dessa prioridade -- decide só pelo poder
      // isolado, ignora efeito de bônus). Na Padrão, qualquer par passa
      // pro recálculo real, que decide pelo total.
      if (priority === 'poder_bruto' && newC.power <= oldP.power) continue

      const withoutOld = current.filter((p) => p !== oldP)
      const swapped = [...withoutOld, placementFromInventoryCandidateAt(newC, oldP)]
      const newTotal = totalPowerNoTemp(buildFinalMiners(swapped), racks)

      if (newTotal > ceilingGhs) continue
      if (priority === 'padrao' && newTotal <= currentTotal) continue

      if (!best || newTotal > best.newTotal) best = { oldP, newC, newTotal }
    }

    if (!best) break

    current = current.filter((p) => p !== best!.oldP)
    current.push(placementFromInventoryCandidateAt(best.newC, best.oldP))
    remaining = remaining.filter((c) => c.instanceKey !== best!.newC.instanceKey)
  }

  return current
}

export function runAutoOptimizer(input: AutoOptimizerInput): AutoOptimizerResult {
  const { mode, priority, ceilingGhs, installedMiners, racks, inventory } = input

  const beforeTotal = totalPowerNoTemp(installedMiners, racks)
  const installedWithPlacement = installedMiners.filter(hasValidPlacement)

  // Base comum aos dois modos: TODO instalado começa na própria posição
  // ORIGINAL (linhas ocupadas + tracker alimentado com o poder/bônus real
  // dele) -- "manter tudo como está" não precisa ser recalculado à parte
  // como um piso de segurança separado, já É o ponto de partida garantido
  // dos dois modos (Prompt 64: começar do ZERO no modo Máximo poder e
  // tratar os instalados como candidatos comuns causava a heurística
  // gulosa gastar o orçamento de bônus de coleção cedo demais em poucos
  // tipos de alto bônus -- bônus de coleção multiplica o poder TOTAL, indo
  // do zero isso trava no teto antes de sequer conseguir recolocar de
  // volta todo mundo que já estava instalado, mesmo quando o total real de
  // TODOS eles juntos caberia folgado).
  const baseRows = buildRows(racks)
  const baseTracker = new RoomPowerTracker()
  const installedPlacements = placeInstalledAtOriginalPositions(baseRows, installedWithPlacement, baseTracker)
  const totalFreeCells = baseRows.reduce((sum, r) => sum + r.freeXs.length, 0)
  const inventoryCandidates = buildInventoryCandidates(inventory, totalFreeCells)

  // Preenche os slots VAZIOS remanescentes com o inventário -- igual pros
  // dois modos (Preservar sala para por aqui; Máximo poder ainda tenta um
  // passo de troca depois, ver runSwapPass).
  const poderBrutoRows = cloneRows(baseRows)
  const poderBrutoTracker = baseTracker.clone()
  const poderBrutoFill = runPoderBruto(poderBrutoRows, inventoryCandidates, ceilingGhs, poderBrutoTracker)

  let fillPlacements = poderBrutoFill
  let fillRows = poderBrutoRows

  if (priority === 'padrao') {
    const padraoRows = cloneRows(baseRows)
    const padraoTracker = baseTracker.clone()
    const padraoFill = runPadrao(padraoRows, inventoryCandidates, ceilingGhs, padraoTracker)

    // Piso de segurança: Padrão nunca pode terminar pior que Poder Bruto no
    // poder total final (requisito explícito) -- a heurística gulosa por
    // maior ganho marginal deveria sempre igualar ou superar uma ordenação
    // estática por poder-base, mas comparamos os totais de qualquer forma
    // em vez de confiar nisso por dedução matemática, garantindo o
    // invariante por construção.
    if (padraoTracker.total >= poderBrutoTracker.total) {
      fillPlacements = padraoFill
      fillRows = padraoRows
    }
  }

  let finalPlacements = [...installedPlacements, ...fillPlacements]
  const finalRows = fillRows

  if (mode === 'maximo_poder') {
    const placedInventoryKeys = new Set(fillPlacements.map((p) => p.instanceKey))
    const remainingInventory = inventoryCandidates.filter((c) => !placedInventoryKeys.has(c.instanceKey))
    finalPlacements = runSwapPass(finalPlacements, remainingInventory, racks, ceilingGhs, priority)
  }

  const finalMiners = buildFinalMiners(finalPlacements)
  const afterTotal = totalPowerNoTemp(finalMiners, racks)

  const changedPlacements = finalPlacements.filter((p) => !p.unchanged)

  const placedInstalledKeys = new Set(
    finalPlacements.filter((p) => p.origin === 'installed').map((p) => p.instanceKey),
  )
  const removedInstalled: OptimizerRemoved[] =
    mode === 'maximo_poder'
      ? installedPlacements
          .filter((p) => !placedInstalledKeys.has(p.instanceKey))
          .map((p) => ({ instanceKey: p.instanceKey, name: p.name, power: p.power }))
      : []

  // Motivo global (não por-slot) pra vazios remanescentes: se ainda sobrou
  // algum candidato do inventário não colocado, o teto de poder é que
  // impediu preencher o resto; se todo o inventário disponível já foi
  // usado, é falta de candidato compatível (inventário acabou antes do
  // espaço físico).
  const placedInventoryFinalKeys = new Set(
    finalPlacements.filter((p) => p.origin === 'inventory').map((p) => p.instanceKey),
  )
  const anyCandidateLeftover = inventoryCandidates.some((c) => !placedInventoryFinalKeys.has(c.instanceKey))

  const emptySlots: OptimizerEmptySlot[] = []
  for (const row of finalRows) {
    for (const x of row.freeXs) {
      emptySlots.push({
        rackInstanceId: row.rackInstanceId,
        rackName: row.rackName,
        roomLevel: row.roomLevel,
        y: row.y,
        x,
        reason: anyCandidateLeftover ? 'sem_orcamento' : 'sem_candidato_compativel',
      })
    }
  }

  return {
    beforeTotal,
    afterTotal,
    placements: changedPlacements,
    removedInstalled,
    emptySlots,
  }
}
