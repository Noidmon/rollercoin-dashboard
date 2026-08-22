// Constantes e fórmula reimplementadas por conta própria a partir de comportamento
// observado (RC Calculator, de Ariel Ruiz), só para cálculo pessoal — nenhum
// código-fonte de terceiros foi copiado ou redistribuído aqui.
import type { EventReward } from './parseEventData'

export interface EventDifficulty {
  baseMultiplier: number // ex: 1, do campo "Multiplicador: Xx cada 1 RLT"
  maxMultiplier: number // ex: 1000, do dropdown de multiplicador disponível
}

export interface RecommendedMultiplier {
  recommended: number
  rltToBuy: number
  ratio: number
  score: number
}

const RLT_PER_PH_FOR_MINER_REWARD = 0.384
const RLT_PER_RST = 1 / 400

export function calculateEventTotalValue(rewards: EventReward[]): number {
  let total = 0
  for (const r of rewards) {
    if (r.rewardType === 'money') {
      if (r.currency === 'RLT') total += r.amount ?? 0
      else if (r.currency === 'RST') total += (r.amount ?? 0) * RLT_PER_RST
    } else if (r.rewardType === 'miner') {
      const powerPhS = (r.powerGhS ?? 0) / 1e6 // Gh/s -> Ph/s
      if (powerPhS >= 1) total += powerPhS * RLT_PER_PH_FOR_MINER_REWARD
    }
    // power_temp e other: não somam nada, de propósito
  }
  return total
}

function scoreFromRatio(u: number): number {
  const tiers: [number, number][] = [
    [0.3, 10],
    [0.35, 9.5],
    [0.4, 9],
    [0.45, 8.5],
    [0.5, 8],
    [0.55, 7.5],
    [0.6, 7],
    [0.7, 6.5],
    [0.75, 6],
    [0.8, 5.5],
    [0.85, 5],
    [0.9, 4.5],
    [0.95, 4],
    [1, 3.5],
    [1.1, 3],
    [1.3, 2.5],
    [1.5, 2],
    [1.8, 1.5],
    [2.2, 1],
  ]
  for (const [max, score] of tiers) if (u <= max) return score
  return 0
}

export function calculateRecommendedMultiplier(
  totalValue: number,
  difficulty: EventDifficulty,
): RecommendedMultiplier {
  const target = totalValue * 0.27 * difficulty.baseMultiplier + 1
  const availableMultipliers = Array.from({ length: difficulty.maxMultiplier }, (_, i) => i + 1)
  const recommended = availableMultipliers.reduce((closest, curr) =>
    Math.abs(curr - target) < Math.abs(closest - target) ? curr : closest,
  )
  const rltToBuy = Math.floor((recommended - 1) / difficulty.baseMultiplier)
  const ratio = rltToBuy / totalValue
  return { recommended, rltToBuy, ratio, score: scoreFromRatio(ratio) }
}
