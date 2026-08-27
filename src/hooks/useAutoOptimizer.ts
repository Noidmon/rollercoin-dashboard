import { useState } from 'react'
import { getLeagueInfo, LEAGUES } from '../data/leagues'
import { runAutoOptimizer, type AutoOptimizerResult, type OptimizerMode, type OptimizerPriority } from '../utils/autoOptimizer'
import type { EnrichedMinerEntry } from './useMinersInventoryImport'
import type { PlayerData } from '../context/PlayerContext'

// Uma opção de teto de liga -- "Topo de {liga} -- até X" = o piso da
// PRÓXIMA liga (ficar "um passo antes de subir"). A última liga (sem
// próxima) não tem teto real no jogo -- representada como Infinity.
export interface LeagueCeilingOption {
  index: number
  label: string
  ceilingGhs: number
}

export function buildLeagueCeilingOptions(formatPower: (v: number) => string): LeagueCeilingOption[] {
  return LEAGUES.map((league, i) => {
    const next = LEAGUES[i + 1]
    const ceilingGhs = next ? next.min : Infinity
    const label = next ? `Topo de ${league.name} — até ${formatPower(ceilingGhs)}` : `${league.name} (sem teto)`
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
export function useAutoOptimizer(playerData: PlayerData, inventory: EnrichedMinerEntry[]) {
  const [priority, setPriority] = useState<OptimizerPriority>('padrao')
  const [mode, setMode] = useState<OptimizerMode>('preservar_sala')
  const [leagueIndex, setLeagueIndex] = useState<number>(() => {
    const { currentLeague } = getLeagueInfo(playerData.max_power)
    return LEAGUES.findIndex((l) => l.name === currentLeague.name)
  })
  const [result, setResult] = useState<AutoOptimizerResult | null>(null)

  function runOptimizer() {
    const nextLeague = LEAGUES[leagueIndex + 1]
    const ceilingGhs = nextLeague ? nextLeague.min : Infinity

    const optimizerResult = runAutoOptimizer({
      mode,
      priority,
      ceilingGhs,
      installedMiners: playerData.roomConfig.miners,
      racks: playerData.roomConfig.racks,
      inventory,
    })
    setResult(optimizerResult)
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
  }
}
