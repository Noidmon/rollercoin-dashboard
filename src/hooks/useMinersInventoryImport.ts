import { useEffect, useState } from 'react'
import { parseMinersInventory } from '../utils/parseMinersInventory'
import { buildMinersByNormalizedNameMap, resolveMinerLevel } from '../utils/matchMinersInventory'
import { getMinerBonusAtLevel, getMinerPowerAtLevel, getRoomDedupMinerId } from '../utils/minerMergeCalculator'
import type { MinersData, Miner } from '../types/miner'

export interface EnrichedMinerEntry {
  key: string
  // Id de dedup pro bônus de coleção -- MESMA convenção usada pelo
  // miner_id real de room-config (id base no nível 0, merges[].mergeId em
  // qualquer outro nível -- ver getRoomDedupMinerId). Necessário pro
  // Auto-Otimizador casar tipos entre inventário colado e sala real na
  // hora de decidir se uma cópia nova soma bônus de coleção extra ou não.
  roomDedupMinerId: string
  name: string
  power: number
  bonus: number
  cells: number
  image: string | null
  quantity: number
  matchedLevel: number
  // Adicionado via o modal "+" (Prompt 76) pra testar hipoteticamente um
  // minerador que o jogador NÃO possui -- nunca vem do texto colado.
  // Undefined/false pra entradas reais. Usado em vários lugares (badge
  // visual no card, computeRemainingInventory) pra nunca misturar o pool
  // hipotético com o pool real do mesmo nome+nível.
  isHypothetical?: boolean
  // Terceira origem possível (Prompt 84) -- item que voltou pro inventário
  // depois de removido da sala (minerador que já estava instalado desde o
  // início da sessão, nunca colado). Ver useRoomRemovedInventory.ts.
  // Mutuamente exclusiva com isHypothetical.
  fromRoomRemoval?: boolean
}

// Estado do inventário colado (Simulador) compartilhado entre o campo de
// colar (dentro do painel de stats) e o painel de resultados (abaixo da
// sala) -- por isso vive num hook único chamado uma vez em Simulador() e
// repassado como props, em vez de duplicado em cada componente.
//
// Reaproveita parseMinersInventory + buildMinersByNormalizedNameMap/
// resolveMinerLevel (as mesmas peças exportadas por matchMinersInventory.ts
// pra esse fim) em vez de matchMinersInventory diretamente -- essa agrega em
// quantidade e descarta a referência ao Miner do catálogo, mas aqui
// precisamos dela pra poder/bônus/células/imagem de cada entrada.
export function useMinersInventoryImport() {
  const [minersData, setMinersData] = useState<MinersData | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [entries, setEntries] = useState<EnrichedMinerEntry[]>([])
  const [unrecognizedCount, setUnrecognizedCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/data/miners.json')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json() as Promise<MinersData>
      })
      .then((json) => {
        if (!cancelled) setMinersData(json)
      })
      .catch(() => {
        if (!cancelled) setMinersData({ generatedAt: '', total: 0, totalMerges: 0, miners: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleImport() {
    if (!minersData) return

    const parsed = parseMinersInventory(pasteText)
    const minersByNormalizedName = buildMinersByNormalizedNameMap(minersData.miners)

    const next: EnrichedMinerEntry[] = []
    let unrecognized = 0

    parsed.forEach((entry, index) => {
      const resolved = resolveMinerLevel(entry.name, entry.powerValue, minersByNormalizedName)
      if (!resolved) {
        unrecognized++
        return
      }
      const miner: Miner = resolved.miner
      next.push({
        key: `${miner.id}-${resolved.matchedLevel}-${index}`,
        roomDedupMinerId: getRoomDedupMinerId(miner, resolved.matchedLevel),
        name: miner.name,
        power: getMinerPowerAtLevel(miner, resolved.matchedLevel),
        bonus: getMinerBonusAtLevel(miner, resolved.matchedLevel),
        cells: miner.cells,
        image: miner.image,
        quantity: entry.quantity,
        matchedLevel: resolved.matchedLevel,
      })
    })

    setEntries(next)
    setUnrecognizedCount(unrecognized)
  }

  return {
    minersReady: minersData !== null,
    pasteText,
    setPasteText,
    entries,
    unrecognizedCount,
    handleImport,
  }
}
