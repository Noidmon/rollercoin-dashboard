import { useState } from 'react'

// Itens de RACK hipotética (Prompt 85, modal "+" do painel de Inventário
// Importado, modo "Rack") -- irmão de useHypotheticalInventory (miners),
// mas com uma diferença de semântica real: rack REAL desmontada
// (useRemovedRacks.ts) é uma instância física ÚNICA, sem "restam N" --
// rack HIPOTÉTICA é o oposto, o jogador está testando "e se eu tivesse N
// dessa rack", então TEM quantidade/"restam N" como qualquer miner
// hipotético (decrementa ao colocar num slot vazio, via recontagem ao vivo
// contra simRoom.racks -- ver computeRemainingRackInventory em simRoom.ts).
export interface HypotheticalRackEntry {
  key: string // = `hyp-rack-${rackId}` -- estável por TIPO de rack, não por instância (não tem instância real nenhuma ainda)
  rackId: string // catálogo (racks.json) -- rack_id
  name: string
  bonus: number // centésimos de %, mesma convenção de Rack.bonus (room-config)
  image: string | null
  widthCells: number
  heightCells: number
  quantity: number
}

export interface HypotheticalRackAddItem {
  rackId: string
  name: string
  bonus: number
  image: string | null
  widthCells: number
  heightCells: number
  quantity: number
}

export function useHypotheticalRackInventory() {
  const [entries, setEntries] = useState<HypotheticalRackEntry[]>([])

  // Upsert por rackId -- mesmo padrão de useHypotheticalInventory: reabrir
  // o modal "+" e escolher outra quantidade pro MESMO tipo de rack
  // substitui a quantidade anterior, não soma.
  function addItems(items: HypotheticalRackAddItem[]) {
    setEntries((prev) => {
      const byKey = new Map(prev.map((e) => [e.key, e]))
      for (const item of items) {
        const key = `hyp-rack-${item.rackId}`
        byKey.set(key, {
          key,
          rackId: item.rackId,
          name: item.name,
          bonus: item.bonus,
          image: item.image,
          widthCells: item.widthCells,
          heightCells: item.heightCells,
          quantity: item.quantity,
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
