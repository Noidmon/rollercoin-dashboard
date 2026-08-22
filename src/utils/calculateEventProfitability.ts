// Constantes e fórmula reimplementadas por conta própria a partir de comportamento
// observado (RC Calculator, de Ariel Ruiz), só para cálculo pessoal — nenhum
// código-fonte de terceiros foi copiado ou redistribuído aqui.
import type { EventData, EventReward } from '../types/event'

const RLT_PER_PH_FOR_MINER_REWARD = 0.384
const RLT_PER_RST = 1 / 400
// Constante da plataforma hoje (confirmado pelo usuário). A RollerCoin pode mudar
// isso no futuro — se o multiplicador máximo real disponível mudar, atualizar aqui.
const KNOWN_MAX_MULTIPLIER = 1000

export interface RecommendedMultiplier {
  totalValue: number
  recommended: number
  rltToBuy: number
  ratio: number
  score: number
}

function classifyRewardValue(reward: EventReward): {
  type: 'money' | 'miner' | 'excluded'
  rltValue: number
} {
  if (reward.reference_type === 'miner' || reward.reference_type === 'merge') {
    const match = reward.value_text.match(/([\d\s]+)\s*Gh\/s/)
    if (match) {
      const powerGhS = parseFloat(match[1].replace(/\s/g, ''))
      const powerPhS = powerGhS / 1e6
      if (powerPhS >= 1) return { type: 'miner', rltValue: powerPhS * RLT_PER_PH_FOR_MINER_REWARD }
    }
    return { type: 'excluded', rltValue: 0 }
  }
  if (reward.reference_type === 'special') {
    const rstMatch = reward.value_text.match(/^(\d+)\s*RST$/)
    if (rstMatch) return { type: 'money', rltValue: parseFloat(rstMatch[1]) * RLT_PER_RST }
    // "Bonus Power" com formato "X Gh/s (Y d)" -- tem parênteses de duração, é temporário, exclui
    return { type: 'excluded', rltValue: 0 }
  }
  return { type: 'excluded', rltValue: 0 } // item, rack
}

export function calculateEventTotalValue(rewards: EventReward[]): number {
  return rewards.reduce((sum, r) => sum + classifyRewardValue(r).rltValue, 0)
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

export function calculateRecommendedMultiplier(event: EventData): RecommendedMultiplier {
  const totalValue = calculateEventTotalValue(event.rewards)
  const baseMultiplier = parseFloat(event.multiplier_exchange_rlt)
  const target = totalValue * 0.27 * baseMultiplier + 1
  const availableMultipliers = Array.from({ length: KNOWN_MAX_MULTIPLIER }, (_, i) => i + 1)
  const recommended = availableMultipliers.reduce((closest, curr) =>
    Math.abs(curr - target) < Math.abs(closest - target) ? curr : closest,
  )
  const rltToBuy = Math.floor((recommended - 1) / baseMultiplier)
  const ratio = rltToBuy / totalValue
  return { totalValue, recommended, rltToBuy, ratio, score: scoreFromRatio(ratio) }
}
