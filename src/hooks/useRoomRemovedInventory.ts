import { useState } from 'react'
import type { EnrichedMinerEntry } from './useMinersInventoryImport'

// Pool de mineradores que voltaram pro inventário depois de removidos da
// sala (Prompt 84 -- reversão da decisão antiga "removido não volta, é
// efêmero"). Só entram aqui instâncias que estavam instaladas desde o
// INÍCIO da sessão (nem fromInventory nem isHypothetical antes da remoção)
// -- um item do texto colado ou hipotético removido de uma rack já
// "reaparece" sozinho no card correspondente via a recontagem ao vivo de
// computeRemainingInventory, sem precisar de nada daqui (ver investigação
// do Prompt 83/84). A decisão de QUAL miner entra aqui é do chamador
// (useAutoOptimizer.ts, que tem acesso ao estado ANTES da remoção) -- este
// hook só guarda o pool, não decide origem.
//
// Semântica de ACUMULAÇÃO (diferente de useHypotheticalInventory, que faz
// upsert por SUBSTITUIÇÃO): cada remoção de um minerador original é um
// evento independente que SOMA à base existente do mesmo nome+nível, nunca
// substitui -- "restam N" aqui funciona exatamente como uma linha agregada
// do texto colado (a "base" é a quantidade TOTAL já removida nesta sessão),
// e o consumo (recolocar um deles) já decrementa sozinho via a mesma
// recontagem ao vivo usada pelas outras 2 origens (nenhuma função de
// "consumir" precisa existir aqui).
export interface RoomRemovalMinerInput {
  roomDedupMinerId: string
  name: string
  power: number
  // % simples (convenção de EnrichedMinerEntry.bonus), não centésimos --
  // conversão já feita pelo chamador.
  bonus: number
  cells: 1 | 2
  image: string | null
  // Convenção de raridade do catálogo (0,2,3,4,5,6... pula o "1") -- MESMA
  // de EnrichedMinerEntry.matchedLevel, já resolvida pelo chamador (via
  // matchRoomMinerInstances contra o catálogo real, não uma conversão
  // aritmética ingênua do level de room-config).
  matchedLevel: number
}

export function useRoomRemovedInventory() {
  const [entries, setEntries] = useState<EnrichedMinerEntry[]>([])

  function addRemoved(item: RoomRemovalMinerInput) {
    setEntries((prev) => {
      const key = `roomrem-${item.roomDedupMinerId}-${item.matchedLevel}`
      const existing = prev.find((e) => e.key === key)
      if (existing) {
        return prev.map((e) => (e.key === key ? { ...e, quantity: e.quantity + 1 } : e))
      }
      return [
        ...prev,
        {
          key,
          roomDedupMinerId: item.roomDedupMinerId,
          name: item.name,
          power: item.power,
          bonus: item.bonus,
          cells: item.cells,
          image: item.image,
          quantity: 1,
          matchedLevel: item.matchedLevel,
          fromRoomRemoval: true,
        },
      ]
    })
  }

  function reset() {
    setEntries([])
  }

  return { entries, addRemoved, reset }
}
