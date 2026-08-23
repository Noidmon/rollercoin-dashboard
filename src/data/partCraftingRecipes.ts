import type { PartType, Rarity } from '../utils/minerMergeCalculator'

export type CraftableRarity = 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface PartCraftRecipe {
  fromRarity: Rarity
  baseQuantity: number
  baseFeeByType: Record<PartType, number>
}

// Valores fixos confirmados nas telas de craft de peça do próprio jogo --
// não seguem fórmula (cada raridade+tipo tem uma taxa própria, hardcoded
// exatamente como aparece lá, sem estimar variação). NÃO confundir com
// LEVEL_TO_RARITY/getMergeLevelRarity de minerMergeCalculator.ts, que é a
// raridade de peça CONSUMIDA num merge de MINERADOR -- isso aqui é o
// crafting de peça pra peça (upgrade de raridade da própria peça).
export const PART_CRAFT_RECIPES: Record<CraftableRarity, PartCraftRecipe> = {
  uncommon: {
    fromRarity: 'common',
    baseQuantity: 50,
    baseFeeByType: { wire: 0.005, hashboard: 0.002, fan: 0.002 },
  },
  rare: {
    fromRarity: 'uncommon',
    baseQuantity: 20,
    baseFeeByType: { wire: 0.002, hashboard: 0.05, fan: 0.05 },
  },
  epic: {
    fromRarity: 'rare',
    baseQuantity: 10,
    baseFeeByType: { wire: 0.05, hashboard: 0.75, fan: 0.75 },
  },
  legendary: {
    fromRarity: 'epic',
    baseQuantity: 5,
    baseFeeByType: { wire: 0.75, hashboard: 1.6, fan: 0.5 },
  },
}

export function getPartCraftRecipe(rarity: Rarity): PartCraftRecipe | null {
  return rarity in PART_CRAFT_RECIPES ? PART_CRAFT_RECIPES[rarity as CraftableRarity] : null
}

// quantidadeExigida = quantidadeBase − Math.floor(quantidadeBase × descontoForja)
// IMPORTANTE: o floor é aplicado no valor DESCONTADO que é subtraído, não
// no resultado final -- confirmado com Epic->Legendary (base 5, desconto
// 10%: floor(5×0.10) = floor(0.5) = 0 subtraído, resultado continua 5, sem
// redução nenhuma nesse caso específico).
export function getDiscountedCraftQuantity(baseQuantity: number, forgeDiscount: number): number {
  return baseQuantity - Math.floor(baseQuantity * forgeDiscount)
}

export function getDiscountedCraftFee(baseFee: number, forgeDiscount: number): number {
  return baseFee * (1 - forgeDiscount)
}
