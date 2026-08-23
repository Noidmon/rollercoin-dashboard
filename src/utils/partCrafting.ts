import { getPartCraftRecipe, getDiscountedCraftFee, getDiscountedCraftQuantity } from '../data/partCraftingRecipes'
import type { PartType, Rarity } from './minerMergeCalculator'

export interface PartCraftingResult {
  fullyCraftable: boolean
  // Quanto de cada raridade (real, do estoque) a simulação precisou tocar
  // pra chegar na quantidade pedida -- pode ter mais de uma entrada quando
  // um nível intermediário só cobre PARTE da necessidade e o resto precisa
  // vir de crafting em cascata a partir de um nível ainda mais baixo.
  consumedByRarity: Partial<Record<Rarity, number>>
  totalRLTCost: number
  // Déficit REAL (na raridade mais baixa alcançada pela simulação) que não
  // dá pra resolver nem craftando -- 0 quando fullyCraftable.
  finalDeficit: number
  finalDeficitRarity: Rarity | null
  // Uso interno: déficit na unidade da PRÓPRIA raridade/tipo passada nessa
  // chamada -- é o que a chamada UM nível acima usa pra fazer sua conta.
  // Não é pra ser lido de fora (fica exposto só por ser o mesmo objeto de
  // retorno em toda a recursão).
  localDeficit: number
}

// Simula craftar a quantidade faltante de uma peça a partir do estoque de
// raridades MENORES que o jogador já possui, subindo em cascata (Common ->
// Uncommon -> Rare -> Epic -> Legendary) sempre que o nível imediatamente
// anterior também não tiver estoque suficiente. Common é a base -- não tem
// receita, então qualquer déficit que sobreviva até lá é definitivo (precisa
// comprar ou farmar).
export function simulatePartCrafting(
  partsOwned: Map<string, number>,
  targetRarity: Rarity,
  type: PartType,
  neededQuantity: number,
  forgeDiscount: number,
): PartCraftingResult {
  const owned = partsOwned.get(`${targetRarity}:${type}`) ?? 0
  const deficit = Math.max(0, neededQuantity - owned)

  if (deficit === 0) {
    return {
      fullyCraftable: true,
      consumedByRarity: {},
      totalRLTCost: 0,
      finalDeficit: 0,
      finalDeficitRarity: null,
      localDeficit: 0,
    }
  }

  const recipe = getPartCraftRecipe(targetRarity)
  if (!recipe) {
    // Common -- sem receita, é a base. O déficit aqui é definitivo.
    return {
      fullyCraftable: false,
      consumedByRarity: {},
      totalRLTCost: 0,
      finalDeficit: deficit,
      finalDeficitRarity: targetRarity,
      localDeficit: deficit,
    }
  }

  const requiredPrevPerUnit = getDiscountedCraftQuantity(recipe.baseQuantity, forgeDiscount)
  const feePerUnit = getDiscountedCraftFee(recipe.baseFeeByType[type], forgeDiscount)
  const prevNeeded = deficit * requiredPrevPerUnit

  const prevResult = simulatePartCrafting(partsOwned, recipe.fromRarity, type, prevNeeded, forgeDiscount)

  const prevObtained = prevNeeded - prevResult.localDeficit
  const unitsCraftable = Math.floor(prevObtained / requiredPrevPerUnit)
  const craftedCost = unitsCraftable * feePerUnit
  const localDeficit = deficit - unitsCraftable

  const consumedByRarity: Partial<Record<Rarity, number>> = { ...prevResult.consumedByRarity }
  if (prevObtained > 0) {
    consumedByRarity[recipe.fromRarity] = (consumedByRarity[recipe.fromRarity] ?? 0) + prevObtained
  }

  return {
    fullyCraftable: localDeficit === 0,
    consumedByRarity,
    totalRLTCost: craftedCost + prevResult.totalRLTCost,
    finalDeficit: prevResult.finalDeficit,
    finalDeficitRarity: prevResult.finalDeficitRarity,
    localDeficit,
  }
}

// Raridade mais BAIXA de fato usada do estoque real pra montar o crafting --
// é a informação mais acionável pro jogador ("vou precisar ter X dessa
// raridade"), mesmo quando níveis intermediários também contribuíram um
// pouco (esses ficam refletidos só no custo total, não em cada linha).
const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']

export function getDeepestConsumedRarity(
  consumedByRarity: Partial<Record<Rarity, number>>,
): { rarity: Rarity; quantity: number } | null {
  for (const rarity of RARITY_ORDER) {
    const quantity = consumedByRarity[rarity]
    if (quantity && quantity > 0) return { rarity, quantity }
  }
  return null
}
