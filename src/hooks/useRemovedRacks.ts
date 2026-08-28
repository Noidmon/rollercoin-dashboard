import { useState } from 'react'
import type { Rack } from '../utils/calculatePower'

// Pool de racks desmontadas nesta sessão (Prompt 84) -- diferente do pool
// de mineradores (useRoomRemovedInventory), aqui NÃO existe "restam N": cada
// rack desmontada é uma instância física ÚNICA (guarda o `_id` real, nome e
// bônus podem variar mesmo entre racks "do mesmo tipo"), então cada uma vira
// uma linha própria na aba RACKS do inventário, reinstalável 1:1 -- nunca
// agregada em quantidade como um minerador.
export interface RemovedRackEntry {
  key: string // = rack._id, único por instância física
  rack: Rack // objeto completo (menos placement, removido na hora de desmontar) -- pronto pra ganhar um placement novo e voltar direto pra simRoom.racks
  image: string | null
}

export function useRemovedRacks() {
  const [entries, setEntries] = useState<RemovedRackEntry[]>([])

  // `rack` já vem SEM placement (desmontada) -- ver useAutoOptimizer.ts.
  function addRemovedRack(rack: Rack, image: string | null) {
    setEntries((prev) => [...prev, { key: rack._id, rack, image }])
  }

  // Tira uma rack do pool pra reinstalar -- devolve o objeto Rack (chamador
  // é quem atribui o placement novo e escreve de volta em simRoom.racks).
  function takeOut(rackInstanceId: string): Rack | undefined {
    const found = entries.find((e) => e.key === rackInstanceId)
    if (!found) return undefined
    setEntries((prev) => prev.filter((e) => e.key !== rackInstanceId))
    return found.rack
  }

  function reset() {
    setEntries([])
  }

  return { entries, addRemovedRack, takeOut, reset }
}
