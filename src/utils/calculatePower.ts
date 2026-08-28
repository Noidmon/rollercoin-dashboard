import { computeSetBonusPercentCentesimos, type MinerSetsData } from './minerSets'

export interface Miner {
  _id?: string
  miner_id?: string
  name?: string
  power: number
  bonus_percent?: number
  placement?: {
    user_rack_id?: string | null
    // x/y: posição LOCAL ao rack (não à sala), em células -- só presentes
    // quando o minerador está de fato posicionado num rack. Usado pra
    // renderizar a posição visual dentro do RoomRacksLayer.
    x?: number
    y?: number
  }
  // Largura em células do minerador dentro do rack (1 ou 2) -- vem direto
  // do room-config real, mesmo campo usado em src/types/miner.ts (`cells`
  // no catálogo, `width` na instância posicionada).
  width?: number
  filename?: string
  frames_data?: {
    frame_width: number
    frame_height: number
    frames_count: number
  }
  // Campos usados só pro selo de nível/set na sala (minerLevelBadges, em
  // roomLayout.ts) -- vêm direto do room-config real. `level` é o número
  // de merges já feitos (0-indexed, ex: base=0), NÃO o nível de raridade
  // exibido no selo (que é level+1 -- confirmado comparando room-config
  // real contra miners.json em investigação anterior).
  type?: string
  level?: number
  is_in_set?: boolean
  // Marca que essa instância foi ADICIONADA a partir do inventário colado
  // durante a sessão de simulação (modal, drag-and-drop, ou Auto-Otimizador)
  // -- NUNCA presente em mineradores que já vieram do room-config real no
  // clone inicial de simRoom (Prompt 75). Usado por computeRemainingInventory
  // (simRoom.ts) pra descontar do "restam N" só cópias realmente consumidas
  // nesta sessão, não a base real já instalada antes de qualquer edição.
  fromInventory?: boolean
  // Marca que essa instância veio de um item HIPOTÉTICO (Prompt 76, modal
  // "+") -- o jogador não possui de verdade, só está testando o impacto.
  // Combinado com fromInventory pra computeRemainingInventory nunca
  // misturar o pool hipotético com o pool real do mesmo nome+nível.
  isHypothetical?: boolean
  // Marca que essa instância voltou pro inventário depois de ser removida
  // da sala (Prompt 84) -- terceira origem possível, mutuamente exclusiva
  // com isHypothetical: é posse REAL (ao contrário de hipotético), mas sem
  // "restam N" vindo de texto colado (ao contrário de fromInventory puro) --
  // a base é a própria quantidade removida da sala nesta sessão. Ver
  // useRoomRemovedInventory.ts e o comentário em computeRemainingInventory
  // (simRoom.ts) sobre a chave de dedup de 3 vias.
  fromRoomRemoval?: boolean
}

export interface Rack {
  _id: string
  name?: string
  bonus: number
  // Campos abaixo só vêm preenchidos quando lidos do room-config real (via
  // roomConfigToRackPlacements) -- não usados no Simulador de "e se"
  // hipotético, onde racks são só {_id,name,bonus}.
  rack_id?: string
  placement?: {
    room_level: number
    x: number
    y: number
  }
  rack_info?: {
    width: number
    height: number
  }
}

export interface RoomPowerBreakdown {
  minersTotal: number
  racksTotal: number
  collectionBonus: number
  temp: number
  total: number
}

export function calculateRoomPower(
  miners: Miner[],
  racks: Rack[],
  gamesPower: number,
  bonusPercent: number,
  temp: number,
): RoomPowerBreakdown {
  const rackBonusById = new Map(racks.map((rack) => [rack._id, rack.bonus]))

  const minersTotal = miners.reduce((sum, miner) => sum + miner.power, 0)

  const racksTotal = miners.reduce((sum, miner) => {
    const rackId = miner.placement?.user_rack_id
    const rackBonus = rackId ? (rackBonusById.get(rackId) ?? 0) : 0
    return sum + (miner.power * rackBonus) / 10000
  }, 0)

  const collectionBonus = (gamesPower + minersTotal) * (bonusPercent / 10000)

  const total = gamesPower + minersTotal + racksTotal + collectionBonus + temp

  return { minersTotal, racksTotal, collectionBonus, temp, total }
}

// Bônus de coleção é por TIPO possuído (miner_id), não por cópia física.
export function sumUniqueMinerBonusPercent(
  miners: Pick<Miner, 'miner_id' | 'bonus_percent'>[],
): number {
  const bonusByType = new Map<string, number>()
  let hypotheticalIndex = 0

  for (const miner of miners) {
    const key = miner.miner_id ?? `__hypothetical_${hypotheticalIndex++}`
    if (!bonusByType.has(key)) {
      bonusByType.set(key, miner.bonus_percent ?? 0)
    }
  }

  let sum = 0
  for (const value of bonusByType.values()) {
    sum += value
  }
  return sum
}

// Função-irmã de sumUniqueMinerBonusPercent -- soma o bônus dedup por
// tipo/nível COM o bônus de sets temáticos (ex: "The Lost Treasure Set"),
// confirmado contra dado real (Prompt 66, ver minerSets.ts pra fonte do
// dado e validação exata). setsData é opcional (undefined enquanto
// public/data/miner-sets.json ainda não carregou) -- nesse caso devolve só
// o dedup por tipo, igual ao comportamento antigo, em vez de quebrar.
export function sumRoomBonusPercentWithSets(
  miners: (Pick<Miner, 'miner_id' | 'bonus_percent'> & Pick<Miner, 'name' | 'level'>)[],
  setsData: MinerSetsData | null | undefined,
): number {
  const dedupBonus = sumUniqueMinerBonusPercent(miners)
  if (!setsData) return dedupBonus
  return dedupBonus + computeSetBonusPercentCentesimos(miners, setsData)
}
