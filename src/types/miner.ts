export interface MinerMerge {
  mergeId: string
  level: number
  power: number
  bonus: number
  mergeFee: number
  requiredPreviousCount: number
  fanCount: number
  fanLevel: number
  hashboardCount: number
  hashboardLevel: number
  wireCount: number
  wireLevel: number
  requirements: unknown[]
}

export interface Miner {
  id: string
  name: string
  slug: string
  sellable: boolean
  mergeable: boolean
  power: number
  bonus: number
  cells: number
  image: string | null
  marketplaceUrl: string
  merges: MinerMerge[]
}

export interface MinersData {
  generatedAt: string
  total: number
  totalMerges: number
  miners: Miner[]
}
