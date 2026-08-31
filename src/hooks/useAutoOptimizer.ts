import { useEffect, useMemo, useState } from 'react'
import { getLeagueInfo, LEAGUES } from '../data/leagues'
import { subtractSmallestDisplayedUnit } from '../utils/formatPower'
import {
  roomPowerBreakdownNoTemp,
  runAutoOptimizer,
  type AutoOptimizerResult,
  type OptimizerMode,
  type OptimizerPriority,
} from '../utils/autoOptimizer'
import { useMinerSetsData } from './useMinerSetsData'
import {
  cloneSimRoomFromReal,
  dismountRackInSim,
  dismountRackMinersInSim,
  minerAt,
  occupantsInRack,
  removeMinerFromSim,
  swapMinerInSim,
  type SimRoomState,
} from '../utils/simRoom'
import type { Miner as RoomMinerInstance, Rack } from '../utils/calculatePower'
import { getRoomDedupMinerId } from '../utils/minerMergeCalculator'
import { matchRoomMinerInstances } from '../utils/matchMinersInventory'
import { withImageBase, withCacheBust } from '../utils/withBase'
import type { MinersData } from '../types/miner'
import type { EnrichedMinerEntry } from './useMinersInventoryImport'
import type { useRoomRemovedInventory, RoomRemovalMinerInput } from './useRoomRemovedInventory'
import type { useRemovedRacks } from './useRemovedRacks'
import type { useHypotheticalRackInventory, HypotheticalRackEntry } from './useHypotheticalRackInventory'
import type { PlayerData } from '../context/PlayerContext'

interface RackCatalogImageEntry {
  rackId: string
  image: string | null
}

// Uma opção de teto de liga -- "Topo de {liga} -- até X" = 1 passo (na
// menor casa decimal exibida) ABAIXO do piso da PRÓXIMA liga, nunca o piso
// em si -- o piso exato da próxima liga JÁ pertence a ela no jogo real
// (ex: próxima liga em 4.000 Zh/s -> teto real "ficar na atual" é
// 3.999 Zh/s, confirmado contra a referência real SmartRoom, Prompt 65).
// A última liga (sem próxima) não tem teto real no jogo -- representada
// como Infinity.
export interface LeagueCeilingOption {
  index: number
  label: string
  ceilingGhs: number
}

// Reaproveitado tanto pelas opções do dropdown quanto pelo cálculo real do
// teto em runOptimizer -- garante que o valor MOSTRADO e o valor
// EFETIVAMENTE aplicado na comparação do algoritmo são sempre o mesmo
// número, nunca dessincronizados.
export function leagueCeilingGhs(leagueIndex: number): number {
  const nextLeague = LEAGUES[leagueIndex + 1]
  return nextLeague ? subtractSmallestDisplayedUnit(nextLeague.min) : Infinity
}

export function buildLeagueCeilingOptions(formatPower: (v: number) => string): LeagueCeilingOption[] {
  return LEAGUES.map((league, i) => {
    const ceilingGhs = leagueCeilingGhs(i)
    const hasNext = i < LEAGUES.length - 1
    const label = hasNext ? `Topo de ${league.name} — até ${formatPower(ceilingGhs)}` : `${league.name} (sem teto)`
    return { index: i, label, ceilingGhs }
  })
}

// Estado do Auto-Otimizador -- prioridade/modo/teto ficam em memória de
// sessão (useState simples, não sessionStorage/servidor -- perdido só se a
// aba fechar ou a página recarregar de verdade, o que já cobre "lembrar a
// última escolha" enquanto o usuário navega dentro do app). Modo não tem
// default fixo pedido explicitamente -- "Preservar sala" foi escolhido como
// primeira seleção por ser a opção menos destrutiva (nunca mexe no que já
// está instalado), não por indicação explícita do pedido original.
export type RoomTab = 'atual' | 'simulacao'

// Resumo AO VIVO (real vs simRoom atual) -- Prompt 72: antes a caixa de
// resumo (AutoOptimizerSummary) só existia/atualizava a partir de
// `result`, que só é escrito dentro de runOptimizer. Isso significava que
// qualquer edição manual (modal de rack) mudava simRoom de verdade, mas o
// resumo continuava mostrando o snapshot do último run do otimizador (ou
// nada, se o otimizador nunca rodou) -- bug real confirmado (usuário
// reportou "3.810 -> 3.810" mesmo depois de trocar um minerador). Corrigido
// recalculando `before`/`after` direto de playerData.roomConfig/simRoom a
// cada render (useMemo), independente de `result` -- `result` continua
// existindo só pro relatório detalhado de mudanças (AutoOptimizerResults),
// que é mesmo sobre "o que o ÚLTIMO run do otimizador fez", não sobre
// edição manual.
export interface LiveOptimizerSummary {
  beforeTotal: number
  afterTotal: number
  beforeBonusPercent: number
  afterBonusPercent: number
  ceilingGhs: number
}

// Prompt 69: promove a sala simulada de "byproduto efêmero do último run
// do Auto-Otimizador" pra estado PRÓPRIO, editável manualmente (modal de
// rack) e independente de rodar o otimizador -- ver investigação no topo
// deste prompt. simRoom é o estado que a aba "Simulação" renderiza e que
// o Auto-Otimizador LÊ como ponto de partida (em vez de sempre reler
// playerData.roomConfig puro) e ESCREVE de volta depois de rodar --
// editar manualmente e depois rodar o otimizador agora compõe (o
// otimizador parte do que já foi editado), pedido explícito do usuário.
// Nenhuma invariante do algoritmo depende de simMiners/simRacks serem
// EXATAMENTE playerData.roomConfig -- runAutoOptimizer só lê arrays de
// miners/racks no mesmo formato, então um subconjunto (racks desmontadas)
// ou uma lista com miners trocados funciona sem mudança nenhuma no motor.
// Prompt 84 (removidos da sala voltam pro inventário -- reversão da
// decisão antiga "efêmero"): roomRemovedInventory/removedRacks são
// instanciados FORA deste hook (SimuladorContent, irmãos de
// useHypotheticalInventory) e passados aqui porque as 4 operações manuais
// de edição (swap/remove/desmontar miners/desmontar rack) e o próprio
// Auto-Otimizador -- que são donos de simRoom -- são os únicos lugares que
// sabem O QUE está sendo desalojado no momento exato da remoção (antes do
// filter descartar o objeto). O hook aqui só ESCREVE nesses 2 pools
// (addRemoved/addRemovedRack) e LÊ de volta pra reinstalar
// (removedRacks.takeOut) -- nunca decide o que entra em allEntries/UI, isso
// continua em SimuladorContent.
export function useAutoOptimizer(
  playerData: PlayerData,
  inventory: EnrichedMinerEntry[],
  roomRemovedInventory: ReturnType<typeof useRoomRemovedInventory>,
  removedRacks: ReturnType<typeof useRemovedRacks>,
  // Prompt 85: só pra reinstallRackOption conseguir resolver se uma "key"
  // escolhida no picker/drag é uma rack hipotética -- nunca é escrito
  // diretamente aqui (colocar uma hipotética não consome nada do pool, a
  // recontagem ao vivo já cuida disso, ver computeRemainingRackInventory).
  hypotheticalRacks: ReturnType<typeof useHypotheticalRackInventory>,
) {
  const [priority, setPriority] = useState<OptimizerPriority>('padrao')
  const [mode, setMode] = useState<OptimizerMode>('preservar_sala')
  const [leagueIndex, setLeagueIndex] = useState<number>(() => {
    const { currentLeague } = getLeagueInfo(playerData.max_power)
    return LEAGUES.findIndex((l) => l.name === currentLeague.name)
  })
  const [result, setResult] = useState<AutoOptimizerResult | null>(null)
  // Aba "Atual"/"Simulação" acima da sala -- as DUAS sempre clicáveis desde
  // o início (Prompt 69: antes "Simulação" só liberava depois do 1º run do
  // otimizador; agora a edição manual não depende disso), mas continua
  // trocando pra "Simulação" automaticamente depois de rodar Otimizar.
  const [activeTab, setActiveTab] = useState<RoomTab>('atual')

  // Catálogo de sets temáticos (bônus de coleção por conjunto, ex: "The
  // Lost Treasure Set") -- Prompt 66. null até carregar; sumRoomBonusPercentWithSets
  // já trata esse caso (cai pro dedup por tipo sozinho, sem quebrar). Hook
  // compartilhado com o Dashboard (Prompt 68) -- ver useMinerSetsData.
  const setsData = useMinerSetsData()

  const [simRoom, setSimRoom] = useState<SimRoomState>(() => cloneSimRoomFromReal(playerData))

  // Catálogos estáticos (Prompt 84) -- só pra resolver imagem/nível/id de
  // dedup de um minerador/rack sendo removido, casando por nome+power
  // (mesma técnica já usada em RoomRacksLayer/SimRackModal, matchRoomMinerInstances)
  // já que RoomMinerInstance/OptimizerRemoved não guardam imagem nenhuma.
  const [minersCatalog, setMinersCatalog] = useState<MinersData | null>(null)
  const [racksCatalog, setRacksCatalog] = useState<RackCatalogImageEntry[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(withCacheBust('/data/miners.json'))
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json() as Promise<MinersData>
      })
      .then((json) => {
        if (!cancelled) setMinersCatalog({ ...json, miners: withImageBase(json.miners) })
      })
      .catch(() => {
        if (!cancelled) setMinersCatalog({ generatedAt: '', total: 0, totalMerges: 0, miners: [] })
      })
    fetch(withCacheBust('/data/racks.json'))
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json() as Promise<{ racks: RackCatalogImageEntry[] }>
      })
      .then((json) => {
        if (!cancelled) setRacksCatalog(withImageBase(json.racks))
      })
      .catch(() => {
        if (!cancelled) setRacksCatalog([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Só instalados desde o INÍCIO da sessão sintetizam uma entrada "removido
  // da sala" -- um item que já veio do texto colado ou do modal "+" e foi
  // instalado nesta sessão já "reaparece" sozinho no card correspondente
  // (recontagem ao vivo de computeRemainingInventory), sem precisar de
  // nada disto (ver investigação do Prompt 83/84, ponto 4).
  function isOriginallyInstalled(m: RoomMinerInstance): boolean {
    return !m.fromInventory && !m.isHypothetical
  }

  // Resolve os dados que faltam (roomDedupMinerId real, imagem, nível na
  // convenção de raridade do catálogo) casando nome+power contra
  // minersCatalog -- mesma técnica de matchRoomMinerInstances já usada pra
  // resolver imagem de miners da sala em RoomRacksLayer/SimRackModal, em vez
  // de reinventar a conversão level+1 (mais frágil pra casos legacy).
  function toRoomRemovalItem(input: {
    name: string
    power: number
    bonusPercent: number
    cells: 1 | 2
  }): RoomRemovalMinerInput | null {
    if (!minersCatalog) return null
    const [resolved] = matchRoomMinerInstances([{ name: input.name, power: input.power }], minersCatalog.miners)
    if (!resolved) return null
    const catalogMiner = minersCatalog.miners.find((c) => c.id === resolved.minerId)
    if (!catalogMiner) return null
    return {
      roomDedupMinerId: getRoomDedupMinerId(catalogMiner, resolved.matchedLevel),
      name: resolved.minerName,
      power: input.power,
      bonus: input.bonusPercent / 100,
      cells: input.cells,
      image: catalogMiner.image,
      matchedLevel: resolved.matchedLevel,
    }
  }

  function reportIfOriginallyInstalled(occupant: RoomMinerInstance | undefined) {
    if (!occupant || !isOriginallyInstalled(occupant)) return
    const item = toRoomRemovalItem({
      name: occupant.name ?? '',
      power: occupant.power,
      bonusPercent: occupant.bonus_percent ?? 0,
      cells: occupant.width === 2 ? 2 : 1,
    })
    if (item) roomRemovedInventory.addRemoved(item)
  }

  // Conta nova carregada (nickname diferente buscado) -- descarta qualquer
  // edição/resultado da conta anterior. Sem isso, trocar de nickname
  // deixaria a sala simulada "vazando" dados de outra conta.
  useEffect(() => {
    setSimRoom(cloneSimRoomFromReal(playerData))
    setResult(null)
    setActiveTab('atual')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerData.avatar])

  function resetSimulation() {
    setSimRoom(cloneSimRoomFromReal(playerData))
    setResult(null)
  }

  // As 4 operações abaixo capturam o ocupante ANTES de chamar setSimRoom
  // (lendo simRoom.miners/racks do closure, não de dentro do updater --
  // setState updaters podem rodar 2x em StrictMode/dev, e reportar a
  // remoção é um efeito colateral que não pode duplicar) -- cada uma é
  // disparada por UM clique/drop do usuário, então o closure já reflete o
  // estado atual no momento do evento.
  function swapMiner(rackInstanceId: string, x: 0 | 1, y: number, entry: EnrichedMinerEntry) {
    reportIfOriginallyInstalled(minerAt(simRoom.miners, rackInstanceId, x, y))
    setSimRoom((prev) => swapMinerInSim(prev, rackInstanceId, x, y, entry, setsData))
  }

  function removeMiner(rackInstanceId: string, x: 0 | 1, y: number) {
    reportIfOriginallyInstalled(minerAt(simRoom.miners, rackInstanceId, x, y))
    setSimRoom((prev) => removeMinerFromSim(prev, rackInstanceId, x, y))
  }

  function dismountRackMiners(rackInstanceId: string) {
    for (const occupant of occupantsInRack(simRoom.miners, rackInstanceId)) {
      reportIfOriginallyInstalled(occupant)
    }
    setSimRoom((prev) => dismountRackMinersInSim(prev, rackInstanceId))
  }

  function dismountRack(rackInstanceId: string) {
    for (const occupant of occupantsInRack(simRoom.miners, rackInstanceId)) {
      reportIfOriginallyInstalled(occupant)
    }
    const rack = simRoom.racks.find((r) => r._id === rackInstanceId)
    // Prompt 85: rack HIPOTÉTICA desmontada NUNCA entra no pool de racks
    // REAIS removidas -- ela só "desaparece" de volta pro próprio pool
    // hipotético, via a mesma recontagem ao vivo que já mostra "restam N"
    // (computeRemainingRackInventory conta direto em simRoom.racks, então
    // tirá-la daqui já é suficiente -- nenhuma escrita extra necessária).
    if (rack && !rack.isHypothetical) {
      const image = rack.rack_id ? (racksCatalog?.find((r) => r.rackId === rack.rack_id)?.image ?? null) : null
      // placement removido -- rack fica "sem posição", pronta pra ganhar
      // uma posição nova ao reinstalar (ver reinstallRack).
      removedRacks.addRemovedRack({ ...rack, placement: undefined }, image)
    }
    setSimRoom((prev) => dismountRackInSim(prev, rackInstanceId))
  }

  // Recoloca uma rack desmontada numa posição vazia da sala (Prompt 84) --
  // qualquer célula válida da tabela Dr pra aquele room_level (nenhuma
  // restrição de "tamanho" -- cada rack ocupa exatamente 1 célula da grade
  // da sala, não importa rack_info.width/height, ver investigação ponto 5).
  function reinstallRack(rackInstanceId: string, roomLevel: number, x: number, y: number) {
    const rack = removedRacks.takeOut(rackInstanceId)
    if (!rack) return
    const placedRack: Rack = { ...rack, placement: { room_level: roomLevel, x, y } }
    setSimRoom((prev) => ({ ...prev, racks: [...prev.racks, placedRack] }))
  }

  // Coloca uma rack HIPOTÉTICA nova numa posição vazia (Prompt 85) -- ao
  // contrário de reinstallRack, não "tira" nada de pool nenhum: a
  // quantidade escolhida no modal é a base fixa, e "restam N" é sempre
  // recalculado ao vivo contra quantas cópias hipotéticas já estão em
  // simRoom.racks (mesmo princípio de minerador hipotético). Cada cópia
  // colocada vira uma instância NOVA com _id sintético próprio (nunca
  // reaproveita o mesmo _id entre cópias, senão duas colocações da mesma
  // rack hipotética colidiriam como "a mesma instância" pro resto do app).
  function placeHypotheticalRack(entry: HypotheticalRackEntry, roomLevel: number, x: number, y: number) {
    const newRack: Rack = {
      _id: `hyp-rack-${entry.rackId}-${roomLevel}-${x}-${y}-${Math.random().toString(36).slice(2, 8)}`,
      name: entry.name,
      bonus: entry.bonus,
      rack_id: entry.rackId,
      rack_info: { width: entry.widthCells, height: entry.heightCells },
      placement: { room_level: roomLevel, x, y },
      isHypothetical: true,
    }
    setSimRoom((prev) => ({ ...prev, racks: [...prev.racks, newRack] }))
  }

  // Ponto de entrada ÚNICO do picker/drag-and-drop (Prompt 85) -- resolve
  // se a "key" escolhida é uma rack REAL desmontada ou uma HIPOTÉTICA e
  // despacha pra função certa, sem a UI (RackReinstallPicker,
  // RoomEmptyRackSlotsLayer) precisar saber a diferença entre os 2 pools.
  function reinstallRackOption(key: string, roomLevel: number, x: number, y: number) {
    if (removedRacks.entries.some((e) => e.key === key)) {
      reinstallRack(key, roomLevel, x, y)
      return
    }
    const hyp = hypotheticalRacks.entries.find((e) => e.key === key)
    if (hyp) placeHypotheticalRack(hyp, roomLevel, x, y)
  }

  const liveSummary: LiveOptimizerSummary = useMemo(() => {
    const before = roomPowerBreakdownNoTemp(playerData.roomConfig.miners, playerData.roomConfig.racks, setsData)
    const after = roomPowerBreakdownNoTemp(simRoom.miners, simRoom.racks, setsData)
    return {
      beforeTotal: before.total,
      afterTotal: after.total,
      beforeBonusPercent: before.bonusPercent,
      afterBonusPercent: after.bonusPercent,
      ceilingGhs: leagueCeilingGhs(leagueIndex),
    }
  }, [playerData.roomConfig, simRoom, setsData, leagueIndex])

  function runOptimizer() {
    const ceilingGhs = leagueCeilingGhs(leagueIndex)

    const optimizerResult = runAutoOptimizer({
      mode,
      priority,
      ceilingGhs,
      installedMiners: simRoom.miners,
      racks: simRoom.racks,
      inventory,
      setsData,
    })
    setResult(optimizerResult)
    // Prompt 84: miners instalados que o modo "Máximo poder" desalojou
    // agora voltam pro pool de removidos, em lote, depois do algoritmo
    // decidir (nunca durante a busca em si -- ver investigação ponto 2).
    for (const removed of optimizerResult.removedInstalled) {
      const item = toRoomRemovalItem({
        name: removed.name,
        power: removed.power,
        bonusPercent: removed.bonusPercent,
        cells: removed.cells,
      })
      if (item) roomRemovedInventory.addRemoved(item)
    }
    // O otimizador só reposiciona MINERS -- racks nunca mudam por conta
    // dele, então simRoom.racks fica como estava (racks desmontadas
    // manualmente continuam fora, o otimizador nunca as recria).
    setSimRoom((prev) => ({ ...prev, miners: optimizerResult.simulatedMiners }))
    setActiveTab('simulacao')
  }

  return {
    priority,
    setPriority,
    mode,
    setMode,
    leagueIndex,
    setLeagueIndex,
    result,
    runOptimizer,
    activeTab,
    setActiveTab,
    simRoom,
    setsData,
    liveSummary,
    resetSimulation,
    swapMiner,
    removeMiner,
    dismountRackMiners,
    dismountRack,
    reinstallRackOption,
  }
}
