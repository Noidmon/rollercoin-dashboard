import { useEffect, useState } from 'react'
import type { MinerSetsData } from '../utils/minerSets'
import { withBase } from '../utils/withBase'

// Catálogo de sets temáticos (public/data/miner-sets.json) -- compartilhado
// entre Auto-Otimizador (useAutoOptimizer) e Dashboard (Prompt 68: "Poder
// Sem Temporário" passou a recalcular localmente igual ao Auto-Otimizador,
// então precisa do mesmo catálogo). null até carregar ou se a busca falhar
// -- sumRoomBonusPercentWithSets já trata esse caso (cai pro dedup por tipo
// sozinho, sem quebrar).
export function useMinerSetsData(): MinerSetsData | null {
  const [setsData, setSetsData] = useState<MinerSetsData | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(withBase('/data/miner-sets.json'))
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json() as Promise<MinerSetsData>
      })
      .then((json) => {
        if (!cancelled) setSetsData(json)
      })
      .catch(() => {
        // sem catálogo de sets -- segue funcionando só com o dedup por
        // tipo/nível, igual ao comportamento antes do Prompt 66.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return setsData
}
