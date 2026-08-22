export interface Miner {
  _id?: string
  miner_id?: string
  name?: string
  power: number
  bonus_percent?: number
  placement?: {
    user_rack_id?: string | null
  }
}

export interface Rack {
  _id: string
  name?: string
  bonus: number
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
