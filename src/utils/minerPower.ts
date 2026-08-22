import type { MinerMerge } from '../types/miner'

export type { MinerMerge }

export interface MinerWithMerges {
  mergeable: boolean
  power: number
  bonus: number
  merges: MinerMerge[]
}

function getStrongestMerge(miner: MinerWithMerges): MinerMerge | null {
  if (!miner.mergeable || miner.merges.length === 0) return null
  // scripts/sync-miners-data.js já grava merges ordenado por level crescente,
  // mas não confiamos cegamente nisso -- ordena de novo e pega o maior level.
  return [...miner.merges].sort((a, b) => b.level - a.level)[0]
}

// Poder/bônus "efetivo" de um minerador pra fins de comparação: o do último
// nível de merge disponível (o mais forte que ele consegue atingir), não o
// do nível base -- é isso que representa a força real dele.
export function getEffectivePower(miner: MinerWithMerges): number {
  const strongest = getStrongestMerge(miner)
  return strongest ? strongest.power : miner.power
}

export function getEffectiveBonus(miner: MinerWithMerges): number {
  const strongest = getStrongestMerge(miner)
  return strongest ? strongest.bonus : miner.bonus
}
