import { useEffect, useState } from 'react'
import { getLeagueInfo, LEAGUES } from '../data/leagues'
import { subtractSmallestDisplayedUnit } from '../utils/formatPower'
import { runAutoOptimizer, type AutoOptimizerResult, type OptimizerMode, type OptimizerPriority } from '../utils/autoOptimizer'
import type { MinerSetsData } from '../utils/minerSets'
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

export function useAutoOptimizer(playerData: PlayerData, inventory: EnrichedMinerEntry[]) {
  const [priority, setPriority] = useState<OptimizerPriority>('padrao')
  const [mode, setMode] = useState<OptimizerMode>('preservar_sala')
  const [leagueIndex, setLeagueIndex] = useState<number>(() => {
    const { currentLeague } = getLeagueInfo(playerData.max_power)
    return LEAGUES.findIndex((l) => l.name === currentLeague.name)
  })
  const [result, setResult] = useState<AutoOptimizerResult | null>(null)
  // Aba "Atual"/"Simulação" acima da sala -- muda pra "Simulação"
  // automaticamente depois de rodar Otimizar (Prompt 65), mas o usuário
  // pode voltar pra "Atual" manualmente a qualquer momento.
  const [activeTab, setActiveTab] = useState<RoomTab>('atual')

  // Catálogo de sets temáticos (bônus de coleção por conjunto, ex: "The
  // Lost Treasure Set") -- Prompt 66. null até carregar; sumRoomBonusPercentWithSets
  // já trata esse caso (cai pro dedup por tipo sozinho, sem quebrar).
  const [setsData, setSetsData] = useState<MinerSetsData | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/data/miner-sets.json')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json() as Promise<MinerSetsData>
      })
      .then((json) => {
        if (!cancelled) setSetsData(json)
      })
      .catch(() => {
        // sem catálogo de sets -- segue funcionando só com o dedup por
        // tipo/nível, igual ao comportamento de antes do Prompt 66.
      })
    return () => {
      cancelled = true
    }
  }, [])

  function runOptimizer() {
    const ceilingGhs = leagueCeilingGhs(leagueIndex)

    const optimizerResult = runAutoOptimizer({
      mode,
      priority,
      ceilingGhs,
      installedMiners: playerData.roomConfig.miners,
      racks: playerData.roomConfig.racks,
      inventory,
      setsData,
      gamesPower: playerData.games,
    })
    setResult(optimizerResult)
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
  }
}
