const DIFFICULTY_INFLUENCE: Record<number, number> = {
  1: 5,
  2: 3.89,
  3: 2.78,
  4: 1.67,
  5: 0.56,
  6: -0.56,
  7: -1.67,
  8: -2.78,
  9: -3.89,
  10: -5,
}

export function calculateBaseSurvivalChance(totalStats: number): number {
  return 20 + 70 * Math.pow((totalStats - 30) / 270, 2)
}

export function calculateHamsterTotalStats(
  hamster: { stats: { health: number; strength: number; luck: number } },
  level: number,
): number {
  return hamster.stats.health + hamster.stats.strength + hamster.stats.luck + (level - 1)
}

export function calculateSurvivalChance(
  totalStats: number,
  difficulty: number,
  abilityBonus: number,
): number {
  const base = calculateBaseSurvivalChance(totalStats)
  const diffInfluence = DIFFICULTY_INFLUENCE[difficulty] ?? 0
  return Math.min(base + diffInfluence + abilityBonus, 100)
}
