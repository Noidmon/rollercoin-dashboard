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
  // Id de dedup pro bônus de coleção, JÁ resolvido pro nível escolhido
  // (Prompt 81) -- mesma convenção usada por mineradores reais
  // (getRoomDedupMinerId: id base no nível 0, merges[].mergeId em
  // qualquer outro nível). Calculado pelo chamador (AddInventoryModal),
  // que tem o Miner completo (com merges[]) em mãos -- esse hook só guarda
  // o resultado, não recalcula.
  roomDedupMinerId: string
  name: string
  power: number
  bonus: number
  cells: number
  image: string | null
  quantity: number
  // Nível de merge escolhido no modal (Prompt 81) -- convenção de
  // raridade do catálogo (0, 2, 3, 4, 5, 6... pula o "1"), mesma de
  // matchedLevel pra itens reais.
  level: number
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
          roomDedupMinerId: item.roomDedupMinerId,
          name: item.name,
          power: item.power,
          bonus: item.bonus,
          cells: item.cells,
          image: item.image,
          quantity: item.quantity,
          matchedLevel: item.level,
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
