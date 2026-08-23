// Parseia o inventário de peças colado pelo jogador (texto puro copiado da
// tela de peças do RollerCoin). Formato real, um bloco por tipo de peça:
//   part image
//   {Raridade}
//   {Tipo}
//   Quantity:
//   {N}
// "part image" é só um marcador visual (não carrega dado) -- ancora em
// "Quantity:" e navega pra trás/frente a partir dela: quantidade = 1 linha
// depois, tipo = 1 linha antes, raridade = 2 linhas antes. Isso ignora
// "part image" automaticamente, sem precisar reconhecê-la explicitamente.

import { parseRarityLabel, parseTypeLabel, type PartType, type Rarity } from './minerMergeCalculator'

export interface PartInventoryEntry {
  rarity: Rarity
  type: PartType
  quantity: number
}

const QUANTITY_LABEL_PATTERN = /^quantity:$/i

export function parsePartsInventory(raw: string): PartInventoryEntry[] {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const entries: PartInventoryEntry[] = []

  for (let i = 0; i < lines.length; i++) {
    if (!QUANTITY_LABEL_PATTERN.test(lines[i])) continue

    const quantityText = lines[i + 1]
    const typeText = lines[i - 1]
    const rarityText = lines[i - 2]

    if (!quantityText || !typeText || !rarityText) continue

    const quantity = Number(quantityText)
    if (Number.isNaN(quantity)) continue

    const rarity = parseRarityLabel(rarityText)
    const type = parseTypeLabel(typeText)
    if (!rarity || !type) continue

    entries.push({ rarity, type, quantity })
  }

  return entries
}
