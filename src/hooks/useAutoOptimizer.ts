import { useEffect, useState } from 'react'
import { getLeagueInfo, LEAGUES } from '../data/leagues'
import { subtractSmallestDisplayedUnit } from '../utils/formatPower'
import { runAutoOptimizer, type AutoOptimizerResult, type OptimizerMode, type OptimizerPriority } from '../utils/autoOptimizer'
import { useMinerSetsData } from './useMinerSetsData'
import {
  cloneSimRoomFromReal,
  dismountRackInSim,
  dismountRackMinersInSim,
  removeMinerFromSim,
  swapMinerInSim,
  type SimRoomState,
} from '../utils/simRoom'
import type { EnrichedMinerEntry } from './useMinersInventoryImport'
import type { PlayerData } from '../context/PlayerContext'

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
export function useAutoOptimizer(playerData: PlayerData, inventory: EnrichedMinerEntry[]) {
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

  function swapMiner(rackInstanceId: string, x: 0 | 1, y: number, entry: EnrichedMinerEntry) {
    setSimRoom((prev) => swapMinerInSim(prev, rackInstanceId, x, y, entry, setsData))
  }

  function removeMiner(rackInstanceId: string, x: 0 | 1, y: number) {
    setSimRoom((prev) => removeMinerFromSim(prev, rackInstanceId, x, y))
  }

  function dismountRackMiners(rackInstanceId: string) {
    setSimRoom((prev) => dismountRackMinersInSim(prev, rackInstanceId))
  }

  function dismountRack(rackInstanceId: string) {
    setSimRoom((prev) => dismountRackInSim(prev, rackInstanceId))
  }

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
    resetSimulation,
    swapMiner,
    removeMiner,
    dismountRackMiners,
    dismountRack,
  }
}
