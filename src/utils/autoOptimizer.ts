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
// Arquitetura (Prompt 64, revisada durante os próprios testes; loop
// iterativo substituiu a troca única no Prompt 65): os DOIS modos partem
// do MESMO ponto -- todo instalado na própria posição original
// (placeInstalledAtOriginalPositions) + inventário preenchendo os slots
// vazios remanescentes (runPoderBruto/runPadrao). Preservar sala para
// exatamente aí. Máximo poder roda uma busca ITERATIVA de melhoria
// contínua em cima desse resultado (runIterativeImprovement): a cada
// rodada, procura o melhor movimento entre preencher um slot vazio ou
// trocar um colocado fraco por um candidato do inventário, valida com
// recálculo REAL (não o tracker incremental) contra o teto, e repete até
// não sobrar movimento vantajoso ou bater um limite de segurança de
// iterações -- não é mais uma troca só (essa versão anterior entregava
// resultado quase nulo numa sala já cheia mesmo quando várias trocas
// vantajosas existiam).
//
// Isso substitui o design ainda mais antigo (tratar TODO instalado como
// candidato comum, competindo do zero junto com o inventário) -- descartado
// depois de confirmar com dado real (conta NoID, bônus de coleção real
// ~3164%) que começar do zero faz a heurística gulosa gastar o "orçamento"
// de bônus cedo demais em poucos tipos de alto bônus (bônus de coleção
// multiplica o poder TOTAL, então cada tipo novo encarece
// desproporcionalmente as adições seguintes) e travar no teto antes de
// sequer conseguir recolocar de volta todo mundo que já estava instalado --
// mesmo quando o total de TODOS eles juntos, sem tocar em nada, já coubesse
// folgado no teto escolhido. Partir da posição original elimina esse
// problema por construção: reconstituir a sala como já estava nunca custa
// nada (já é onde cada um está), e só o que REALMENTE precisa de uma
// decisão (o que fazer com os slots vazios, e -- só no Máximo poder -- se
// vale trocar algum colocado fraco) passa pela heurística.
import {
  calculateRoomPower,
  sumRoomBonusPercentWithSets,
  type Miner as RoomMinerInstance,
  type Rack,
} from './calculatePower'
import { roomConfigToRackPlacements } from './roomLayout'
import type { EnrichedMinerEntry } from '../hooks/useMinersInventoryImport'
import { isNameInAnySet, type MinerSetsData } from './minerSets'

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
  // Nível na convenção de room-config (nº de merges feitos, 0-indexed) --
  // precisa ir junto pra minerSets.ts conseguir casar contra o catálogo de
  // sets (que usa o nível de raridade 1-indexed, level+1) na hora de
  // recalcular o total FINAL via buildFinalMiners. Bug real corrigido
  // (Prompt 66): sem isso, TODO minerador simulado perdia o próprio nível
  // (virava 0/undefined), quebrando o bônus de set inteiro pra QUALQUER
  // simulação -- mesmo uma que não tocasse nos membros do set.
  level: number
  // `type` room-config (ex: "merge", "old_merge"/"legacy") e `isInSet`
  // (fato estático de catálogo, ver isNameInAnySet) -- só usados pro selo
  // visual (minerLevelBadges/RoomRacksLayer), sem efeito no cálculo de
  // poder/bônus. Sem esses dois, TODO minerador reconstruído via
  // buildFinalMiners perdia o selo de nível/set na aba Simulação (bug real
  // encontrado testando visualmente o Prompt 66 -- badges desapareciam da
  // sala inteira, não só de quem mudou).
  type: string | undefined
  isInSet: boolean | undefined
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
  level: number
  type: string | undefined
  isInSet: boolean | undefined
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
  // Convenção nativa de room-config (nº de merges feitos, 0-indexed) --
  // ver o comentário equivalente em Candidate.level (Prompt 66).
  level: number
  // Ver comentário equivalente em Candidate (Prompt 66) -- só pro selo
  // visual, sem efeito no cálculo.
  type: string | undefined
  isInSet: boolean | undefined
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

// Prompt 84 (removidos voltam pro inventário, reversão da decisão antiga
// "efêmero"): bonusPercent/cells adicionados -- são os campos que faltavam
// pra o chamador (useAutoOptimizer.ts) reconstruir uma entrada de
// inventário completa a partir daqui. roomDedupMinerId/level/image não
// entraram: o chamador já precisa casar name+power contra o catálogo real
// (matchRoomMinerInstances) pra resolver a imagem de qualquer forma (essa
// info nunca existiu aqui -- ver `image: null` fixo em
// placeInstalledAtOriginalPositions), então reaproveita o MESMO casamento
// pra também obter roomDedupMinerId/matchedLevel corretos, em vez de
// carregar 2 fontes de verdade pro mesmo dado.
export interface OptimizerRemoved {
  instanceKey: string
  name: string
  power: number
  bonusPercent: number
  cells: 1 | 2
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
  // Bônus de coleção (dedup) antes/depois -- % em centésimos (convenção
  // nativa de room-config) e valor em Gh/s (a própria parcela collectionBonus
  // da fórmula) -- usado pelo resumo da UI (Prompt 65, "Bônus atual ->
  // estimado").
  beforeBonusPercent: number
  afterBonusPercent: number
  beforeBonusValue: number
  afterBonusValue: number
  // Teto efetivamente aplicado (já com a correção de 1 unidade abaixo do
  // piso da próxima liga) -- devolvido pra UI computar "usando X%, folga Y"
  // sem duplicar o cálculo.
  ceilingGhs: number
  // Array completo (instalados inalterados + mudanças) no MESMO formato de
  // playerData.roomConfig.miners -- pronto pra alimentar RoomRacksLayer
  // direto na aba "Simulação" (Prompt 65), sem a UI precisar reconstruir
  // isso sozinha a partir da lista de mudanças.
  simulatedMiners: RoomMinerInstance[]
  placements: OptimizerPlacement[]
  removedInstalled: OptimizerRemoved[]
  emptySlots: OptimizerEmptySlot[]
  // Telemetria da busca iterativa (só preenchida no modo Máximo poder --
  // Preservar sala não itera, então fica null). iterations = quantas
  // rodadas de melhoria rodaram de fato; converged=false significa que
  // bateu no limite de segurança (MAX_ITERATIONS) sem esgotar as trocas
  // vantajosas -- reportado explicitamente em vez de fingir que convergiu.
  iterativeSearch: { iterations: number; converged: boolean; elapsedMs: number } | null
}

export interface AutoOptimizerInput {
  mode: OptimizerMode
  priority: OptimizerPriority
  ceilingGhs: number
  installedMiners: RoomMinerInstance[]
  racks: Rack[]
  inventory: EnrichedMinerEntry[]
  // Catálogo de sets temáticos (public/data/miner-sets.json) -- null
  // enquanto ainda não carregou (nesse caso o bônus de set fica de fora do
  // cálculo até carregar, sem quebrar nada -- ver sumRoomBonusPercentWithSets).
  setsData: MinerSetsData | null
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
      level: m.level ?? 0,
      type: m.type,
      isInSet: m.is_in_set,
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
function buildInventoryCandidates(
  inventory: EnrichedMinerEntry[],
  totalFreeCells: number,
  setsData: MinerSetsData | null,
): Candidate[] {
  const candidates: Candidate[] = []
  let cellsUsedSoFar = 0

  for (const entry of inventory) {
    const cells = entry.cells === 2 ? 2 : 1
    const maxCopiesByCells = Math.floor((totalFreeCells - cellsUsedSoFar) / cells)
    const copies = Math.max(0, Math.min(entry.quantity, maxCopiesByCells))
    const level = entry.matchedLevel === 0 ? 0 : entry.matchedLevel - 1
    // Inventário colado não informa "type" real (old_merge/legacy vs
    // merge) -- não dá pra distinguir peça vintage/legacy só por
    // nome+power. Aproxima como 'merge' quando o nível indica que passou
    // por merge (level>0), que é o caso que faz o selo aparecer; miners
    // base (level=0) nunca mostram selo de nível de qualquer forma, então
    // o valor de `type` não importa nesse caso. Limitação documentada, não
    // escondida: um legacy raro apareceria com o selo de nível normal em
    // vez do selo especial "legacy", nunca com o selo faltando.
    const type = level > 0 ? 'merge' : undefined
    const isInSet = setsData ? isNameInAnySet(entry.name, setsData) : undefined

    for (let i = 0; i < copies; i++) {
      candidates.push({
        groupKey: `inventory:${entry.key}`,
        instanceKey: `${entry.key}-copy${i}`,
        roomDedupMinerId: entry.roomDedupMinerId,
        name: entry.name,
        power: entry.power,
        bonusPercent: entry.bonus * 100, // catálogo (%) -> convenção room-config (centésimos de %)
        // matchedLevel usa a numeração de raridade do catálogo (0, 2, 3, 4,
        // 5, 6 -- pula o "1"); converte pra convenção 0-indexada de
        // room-config (nº de merges feitos) subtraindo 1, exceto no caso
        // base (0 continua 0 nos dois esquemas).
        level,
        type,
        isInSet,
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
        level: c.level,
        type: c.type,
        isInSet: c.isInSet,
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
    level: candidate.level,
    type: candidate.type,
    isInSet: candidate.isInSet,
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

// Bug real reportado: a ordem VISUAL de qual minerador ocupa qual slot
// dentro de uma rack não seguia nenhum critério de valor -- dependia só da
// ordem de iteração do algoritmo de busca (poder-base decrescente pra Poder
// Bruto, ganho marginal pra Padrão, ordem das trocas decididas pelo loop do
// Máximo poder), nunca reordenada depois pra refletir a posição final.
// Investigação confirmada (Prompt 86): (1) é puramente cosmético -- rackBonus
// é uniforme por rack (mesmo valor pra toda linha/x da MESMA rack, ver
// buildRows) e o dedup de bônus de coleção é por TIPO de minerador, nunca por
// posição (sumRoomBonusPercentWithSets), então reordenar QUEM ocupa QUAL slot
// dentro da MESMA rack nunca muda minersTotal/racksTotal/bonusSum -- total
// final idêntico antes/depois; (2) não existe fonte de não-determinismo real
// (nenhum Map/Set cuja ordem de iteração importasse aqui) -- já era
// determinístico rodada a rodada, só não fazia sentido visualmente (não
// bate com a referência ariel-ruiz/ROOMS, que preenche sempre do melhor pro
// pior).
//
// Reordena TODOS os placements de cada rack (inclusive unchanged===true --
// ver por quê abaixo), separando por largura (1 ou 2 células -- nunca
// mistura um slot de largura 1 com um de largura 2, cada grupo só troca de
// posição com outro do MESMO grupo) e reatribuindo as MESMAS posições
// (x,y) já ocupadas por esse grupo dentro da rack, da linha mais baixa (y
// menor, prateleira de baixo/mais visível) pra cima, maior poder primeiro
// (bônus como desempate, também decrescente).
//
// Por que também reordena unchanged===true (achado testando com dado real,
// conta NoID): uma rack pode ter uma MISTURA de instalados que o algoritmo
// não precisou tocar (unchanged=true) com outros que ele trocou/adicionou
// nesta rodada -- se só reordenássemos os "mudados" preservando a posição
// exata dos "não mudados", um unchanged forte podia continuar visualmente
// "atrás" de um mudado mais fraco (rack real "Trophy Rack 8" confirmou esse
// caso: [5,5,4,15,5.5] em vez de [15,5.5,5,5,4], em trilhões de Gh/s). A
// flag `unchanged` continua com o MESMO valor depois daqui -- ela descreve
// se o algoritmo de SELEÇÃO precisou realocar essa peça pra outra
// rack/removê-la (usado no relatório "mudanças"), não a posição visual
// exata dentro da rack em que ela já estava -- mover só o slot (nunca a
// rack) não afeta esse significado nem o poder total (ver comentário acima).
function reorderPlacementsWithinRacks(placements: OptimizerPlacement[]): OptimizerPlacement[] {
  const byRack = new Map<string, OptimizerPlacement[]>()
  for (const p of placements) {
    const list = byRack.get(p.rackInstanceId) ?? []
    list.push(p)
    byRack.set(p.rackInstanceId, list)
  }

  const reordered: OptimizerPlacement[] = []
  for (const rackPlacements of byRack.values()) {
    for (const cells of [1, 2] as const) {
      const group = rackPlacements.filter((p) => p.cells === cells)
      if (group.length === 0) continue
      const positions = group.map((p) => ({ x: p.x, y: p.y })).sort((a, b) => a.y - b.y || a.x - b.x)
      const sorted = [...group].sort((a, b) => b.power - a.power || b.bonusPercent - a.bonusPercent)
      sorted.forEach((p, i) => reordered.push({ ...p, x: positions[i].x, y: positions[i].y }))
    }
  }
  return reordered
}

function buildFinalMiners(placements: OptimizerPlacement[]): RoomMinerInstance[] {
  return placements.map((p) => ({
    _id: p.instanceKey,
    miner_id: p.roomDedupMinerId,
    name: p.name,
    power: p.power,
    bonus_percent: p.bonusPercent,
    level: p.level,
    type: p.type,
    is_in_set: p.isInSet,
    placement: { user_rack_id: p.rackInstanceId, x: p.x, y: p.y },
    width: p.cells,
    // Marca explícita de origem (Prompt 75) -- placements com
    // origin==='installed' são o minerador ORIGINAL só reposicionado
    // (mesma cópia física, nunca consumiu inventário); só
    // origin==='inventory' realmente veio do inventário colado, mesmo
    // critério usado pelo modal/drag-and-drop em simRoom.ts.
    fromInventory: p.origin === 'inventory',
  }))
}

// gamesPower SEMPRE 0 aqui -- "games" é oficialmente TEMPORÁRIO no
// RollerCoin (dura 1/3/5/7 dias conforme nível do PC, categoria separada
// de "Temporary" mas igualmente não-permanente), confirmado pelo usuário.
// Uma rodada anterior (Prompt 67) threadou gamesPower real achando que
// fechava um gap contra o Dashboard -- estava ERRADO, revertido (Prompt
// 68): "poder sem temporário" nunca deveria incluir games, então
// current_power-temp (que inclui games) NUNCA é a fonte certa de
// comparação pra esse número -- ver comentário no topo do arquivo.
function totalPowerNoTemp(miners: RoomMinerInstance[], racks: Rack[], setsData: MinerSetsData | null): number {
  const bonusPercent = sumRoomBonusPercentWithSets(miners, setsData)
  return calculateRoomPower(miners, racks, 0, bonusPercent, 0).total
}

// Versão com o detalhamento de bônus (% e valor) -- usada nos pontos
// ANTES/DEPOIS (não durante a busca, que só precisa do total via
// totalPowerNoTemp) pro resumo da UI (Prompt 65: "Bônus atual ->
// estimado"). Exportada (Prompt 72) -- useAutoOptimizer usa direto pra
// recalcular o resumo AO VIVO a partir de simRoom a cada edição manual,
// não só depois de rodar o otimizador (ver bug real corrigido lá).
export function roomPowerBreakdownNoTemp(
  miners: RoomMinerInstance[],
  racks: Rack[],
  setsData: MinerSetsData | null,
): { total: number; bonusPercent: number; bonusValue: number } {
  const bonusPercent = sumRoomBonusPercentWithSets(miners, setsData)
  const breakdown = calculateRoomPower(miners, racks, 0, bonusPercent, 0)
  return { total: breakdown.total, bonusPercent, bonusValue: breakdown.collectionBonus }
}

function placementFromInventoryCandidateAt(candidate: Candidate, at: OptimizerPlacement): OptimizerPlacement {
  return {
    instanceKey: candidate.instanceKey,
    roomDedupMinerId: candidate.roomDedupMinerId,
    name: candidate.name,
    power: candidate.power,
    bonusPercent: candidate.bonusPercent,
    level: candidate.level,
    type: candidate.type,
    isInSet: candidate.isInSet,
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

export interface IterativeImprovementResult {
  placements: OptimizerPlacement[]
  iterations: number
  converged: boolean
  elapsedMs: number
}

// Limite de segurança de iterações (Prompt 65) -- se bater nisso, reporta
// não-convergência em vez de fingir que terminou (sinal de que precisaria
// de outra abordagem, não de rodar mais um pouco).
const MAX_ITERATIONS = 700
// Corta a busca por rodada a um subconjunto -- com 500+ candidatos de
// inventário e ~200 instalados, testar TODO par a cada rodada (centenas de
// milhares de recálculos completos de calculateRoomPower) seria caro
// demais. Considera só os N candidatos do inventário de MAIOR poder-base
// ainda não usados (são os que mais provavelmente valem uma troca) contra
// os M colocados de MENOR poder (os mais prováveis de valer trocar) --
// documentado aqui em vez de escondido: é uma heurística, não busca
// exaustiva.
const TOP_K_INVENTORY = 40
const BOTTOM_K_PLACED = 40

type Move =
  | { kind: 'fill'; row: WorkingRow; candidate: Candidate; total: number }
  | { kind: 'swap'; oldP: OptimizerPlacement; candidate: Candidate; total: number }

// Agrupa linhas com o MESMO perfil (bônus de rack + quantas células livres)
// -- pra decidir SE vale preencher uma célula vazia com um candidato, só o
// perfil importa (poder resultante é idêntico pra qualquer linha do mesmo
// perfil), então testar 1 representante por perfil em vez de toda linha
// individualmente corta a busca de preenchimento de ~centenas de linhas
// pra só um punhado de perfis distintos, sem perder nenhuma opção real.
function representativeRowsByProfile(rows: WorkingRow[]): WorkingRow[] {
  const seen = new Map<string, WorkingRow>()
  for (const row of rows) {
    if (row.freeXs.length === 0) continue
    const key = `${row.rackBonus}:${row.freeXs.length}`
    if (!seen.has(key)) seen.set(key, row)
  }
  return [...seen.values()]
}

// Melhoria iterativa contínua, só pro modo Máximo poder -- substitui a
// versão anterior de "1 troca bounded" (Prompt 64), que entregava resultado
// quase nulo numa sala já cheia com bônus de coleção alto (a proteção
// contra o bug multiplicativo funcionava, mas só tentava UMA troca por
// execução em vez de continuar buscando). Ponto de partida continua "tudo
// onde já está" (mesma proteção). A cada rodada, procura o melhor movimento
// entre PREENCHER um slot vazio ou TROCAR um colocado fraco por um
// candidato do inventário, valida com recálculo REAL (calculateRoomPower,
// não estimativa incremental) contra o teto E contra o total atual antes
// de aceitar, e repete até não sobrar movimento vantajoso ou bater o limite
// de segurança (ver MAX_ITERATIONS).
function runIterativeImprovement(
  rows: WorkingRow[],
  initialPlacements: OptimizerPlacement[],
  initialRemainingInventory: Candidate[],
  racks: Rack[],
  ceilingGhs: number,
  priority: OptimizerPriority,
  setsData: MinerSetsData | null,
): IterativeImprovementResult {
  const startedAt = Date.now()
  let current = [...initialPlacements]
  let remaining = [...initialRemainingInventory]
  let currentTotal = totalPowerNoTemp(buildFinalMiners(current), racks, setsData)

  let iterations = 0
  let converged = false

  for (; iterations < MAX_ITERATIONS; iterations++) {
    if (remaining.length === 0) {
      converged = true
      break
    }

    const topInventory = [...remaining].sort((a, b) => b.power - a.power).slice(0, TOP_K_INVENTORY)
    const fillRows = representativeRowsByProfile(rows)
    const weakestPlaced = [...current].sort((a, b) => a.power - b.power).slice(0, BOTTOM_K_PLACED)

    let best: Move | null = null

    // Opção A -- preencher um slot vazio (1 linha representante por perfil
    // de bônus+capacidade, ver representativeRowsByProfile).
    for (const row of fillRows) {
      for (const cand of topInventory) {
        if (cand.cells > row.freeXs.length) continue
        if (cand.cells === 2 && row.freeXs.length !== 2) continue

        const trial = [...current, placementFromCandidate(cand, row, 0)]
        const total = totalPowerNoTemp(buildFinalMiners(trial), racks, setsData)
        if (total > ceilingGhs || total <= currentTotal) continue
        if (!best || total > best.total) best = { kind: 'fill', row, candidate: cand, total }
      }
    }

    // Opção B -- trocar um colocado fraco (instalado OU já preenchido pelo
    // inventário numa rodada anterior) por um candidato mais forte.
    for (const oldP of weakestPlaced) {
      for (const cand of topInventory) {
        if (cand.cells !== oldP.cells) continue
        // Mesma regra de prioridade já usada no resto do algoritmo: Poder
        // Bruto só considera a troca se o poder ISOLADO aumenta (ignora
        // efeito de bônus na escolha); Padrão deixa qualquer par passar
        // pro recálculo real, que decide pelo total.
        if (priority === 'poder_bruto' && cand.power <= oldP.power) continue

        const trial = [...current.filter((p) => p !== oldP), placementFromInventoryCandidateAt(cand, oldP)]
        const total = totalPowerNoTemp(buildFinalMiners(trial), racks, setsData)
        if (total > ceilingGhs || total <= currentTotal) continue
        if (!best || total > best.total) best = { kind: 'swap', oldP, candidate: cand, total }
      }
    }

    if (!best) {
      converged = true
      break
    }

    if (best.kind === 'fill') {
      const x = takeFreeX(best.row, best.candidate.cells)
      current = [...current, placementFromCandidate(best.candidate, best.row, x)]
    } else {
      current = [...current.filter((p) => p !== best!.oldP), placementFromInventoryCandidateAt(best.candidate, best.oldP)]
    }
    remaining = remaining.filter((c) => c.instanceKey !== best!.candidate.instanceKey)
    currentTotal = best.total
  }

  return { placements: current, iterations, converged, elapsedMs: Date.now() - startedAt }
}

export function runAutoOptimizer(input: AutoOptimizerInput): AutoOptimizerResult {
  const { mode, priority, ceilingGhs, installedMiners, racks, inventory, setsData } = input

  const before = roomPowerBreakdownNoTemp(installedMiners, racks, setsData)
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
  // Capacidade FÍSICA TOTAL da sala (2 células por linha, sempre) --
  // capturada ANTES de ocupar com os instalados, porque o modo Máximo
  // poder pode trocar candidatos do inventário por instalados já
  // colocados (runIterativeImprovement), não só preencher espaço LIVRE.
  // Bug real encontrado testando com dado real (sala 100% ocupada, 0
  // células livres): capar buildInventoryCandidates pela capacidade LIVRE
  // (sempre 0 nesse cenário) zerava o pool de candidatos inteiro antes da
  // busca de troca sequer começar -- capar pela capacidade TOTAL corrige
  // isso sem soltar candidatos além do que a sala poderia fisicamente usar
  // em QUALQUER arranjo (preenchimento ou troca).
  const totalCapacityCells = baseRows.reduce((sum, r) => sum + r.freeXs.length, 0)
  const inventoryCandidates = buildInventoryCandidates(inventory, totalCapacityCells, setsData)

  const baseTracker = new RoomPowerTracker()
  const installedPlacements = placeInstalledAtOriginalPositions(baseRows, installedWithPlacement, baseTracker)

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
  let iterativeSearch: AutoOptimizerResult['iterativeSearch'] = null

  if (mode === 'maximo_poder') {
    const placedInventoryKeys = new Set(fillPlacements.map((p) => p.instanceKey))
    const remainingInventory = inventoryCandidates.filter((c) => !placedInventoryKeys.has(c.instanceKey))
    const improvement = runIterativeImprovement(
      finalRows,
      finalPlacements,
      remainingInventory,
      racks,
      ceilingGhs,
      priority,
      setsData,
    )
    finalPlacements = improvement.placements
    iterativeSearch = {
      iterations: improvement.iterations,
      converged: improvement.converged,
      elapsedMs: improvement.elapsedMs,
    }
  }

  // Reordenação puramente visual (Prompt 86) -- ver comentário na função:
  // não muda poder algum, só QUAL slot cada minerador ESCOLHIDO ocupa
  // dentro da rack em que já foi decidido que ele entra.
  finalPlacements = reorderPlacementsWithinRacks(finalPlacements)

  const finalMiners = buildFinalMiners(finalPlacements)
  const after = roomPowerBreakdownNoTemp(finalMiners, racks, setsData)

  const changedPlacements = finalPlacements.filter((p) => !p.unchanged)

  const placedInstalledKeys = new Set(
    finalPlacements.filter((p) => p.origin === 'installed').map((p) => p.instanceKey),
  )
  const removedInstalled: OptimizerRemoved[] =
    mode === 'maximo_poder'
      ? installedPlacements
          .filter((p) => !placedInstalledKeys.has(p.instanceKey))
          .map((p) => ({ instanceKey: p.instanceKey, name: p.name, power: p.power, bonusPercent: p.bonusPercent, cells: p.cells }))
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
    beforeTotal: before.total,
    afterTotal: after.total,
    beforeBonusPercent: before.bonusPercent,
    afterBonusPercent: after.bonusPercent,
    beforeBonusValue: before.bonusValue,
    afterBonusValue: after.bonusValue,
    ceilingGhs,
    simulatedMiners: finalMiners,
    placements: changedPlacements,
    removedInstalled,
    emptySlots,
    iterativeSearch,
  }
}
