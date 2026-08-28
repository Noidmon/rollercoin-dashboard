import { useState } from 'react'
import type { EnrichedMinerEntry } from './useMinersInventoryImport'

// Itens de teste hipotético (Prompt 76, modal "+" do painel de
// Inventário Importado) -- minerador que o jogador NÃO possui, só quer
// ver o impacto de poder. Vive num hook PRÓPRIO (não dentro de
// useMinersInventoryImport) porque a origem do dado é completamente
// diferente (stepper de quantidade do modal, nunca texto colado) e porque
// precisa ser resetável independentemente ("Resetar Simulação" remove
// esses itens por completo -- ver comentário em Simulador.tsx).
export interface HypotheticalAddItem {
  catalogId: string
  name: string
  power: number
  bonus: number
  cells: number
  image: string | null
  quantity: number
}

export function useHypotheticalInventory() {
  const [entries, setEntries] = useState<EnrichedMinerEntry[]>([])

  // Upsert por catalogId -- adicionar o MESMO minerador de novo (reabrindo
  // o modal "+" e escolhendo uma quantidade diferente) substitui a
  // quantidade anterior em vez de somar, evitando acúmulo silencioso que
  // o usuário não pediu explicitamente.
  function addItems(items: HypotheticalAddItem[]) {
    setEntries((prev) => {
      const byKey = new Map(prev.map((e) => [e.key, e]))
      for (const item of items) {
        const key = `hyp-${item.catalogId}`
        byKey.set(key, {
          key,
          roomDedupMinerId: item.catalogId,
          name: item.name,
          power: item.power,
          bonus: item.bonus,
          cells: item.cells,
          image: item.image,
          quantity: item.quantity,
          matchedLevel: 0,
          isHypothetical: true,
        })
      }
      return [...byKey.values()]
    })
  }

  function reset() {
    setEntries([])
  }

  return { entries, addItems, reset }
}
