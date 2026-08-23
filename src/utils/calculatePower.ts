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
