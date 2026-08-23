// Parseia texto colado do marketplace do RollerCoin. O formato REAL (o que o
// usuário cola ao selecionar/copiar da tela do jogo) tem uma linha "product"
// opcional antes do nome (nem sempre presente -- não confiar nela) e linhas
// em branco entre cada campo:
//   product
//   Common Hashboard
//
//   Quantity: 2 878 568
//
//   From
//
//   0.021 RLT
// Contagem fixa de linhas (4 ou 5) é frágil -- já quebrou duas vezes porque
// a presença da linha "product" e das linhas em branco varia. Em vez disso,
// ancora em "From" (linha fixa e sempre presente) e navega relativo a ela:
// preço = 1 linha depois, quantidade = 1 linha antes (ignorada), nome = 2
// linhas antes -- depois de remover linhas vazias, então funciona tenha ou
// não a linha "product", e independente de quantas linhas em branco existam.
//
// Também aceita o formato antigo com links markdown, onde cada linha vem
// como [texto](url) -- extrai só o texto antes de aplicar a mesma lógica.

import { parsePartName } from './minerMergeCalculator'

export interface ParsedPartPrice {
  name: string
  priceRLT: number
}

export interface ParseMarketplaceResult {
  prices: ParsedPartPrice[]
  skippedCount: number
}

const MARKDOWN_LINK_LINE_PATTERN = /^\[(.*)\]\(.*\)$/
const FROM_PATTERN = /^from$/i
const PRICE_PATTERN = /^([\d.,]+)\s*RLT$/i

// \s no JS já cobre espaço não-quebrável (U+00A0), que vem junto às vezes
// quando o texto é copiado de uma página web -- sem essa normalização,
// "Epic Fan" (visualmente idêntico a "Epic Fan") não bate com a chave
// gerada por partPriceKey() na hora de buscar o preço, e o preço colado
// silenciosamente nunca é aplicado.
export function normalizePartName(name: string): string {
  return name.replace(/\s+/g, ' ').trim()
}

function extractLineValue(line: string): string {
  const match = line.match(MARKDOWN_LINK_LINE_PATTERN)
  return normalizePartName(match ? match[1] : line)
}

export function parseMarketplacePaste(raw: string): ParseMarketplaceResult {
  const lines = raw
    .split('\n')
    .map(extractLineValue)
    .filter((line) => line.length > 0)

  const prices: ParsedPartPrice[] = []
  let skippedCount = 0

  for (let i = 0; i < lines.length; i++) {
    if (!FROM_PATTERN.test(lines[i])) continue

    const priceLine = lines[i + 1]
    const nameLine = lines[i - 2]

    if (!priceLine || !nameLine) {
      skippedCount++
      continue
    }

    const priceMatch = priceLine.match(PRICE_PATTERN)
    if (!priceMatch) {
      skippedCount++
      continue
    }

    if (!parsePartName(nameLine)) {
      skippedCount++
      continue
    }

    const priceRLT = Number(priceMatch[1].replace(',', '.'))
    if (Number.isNaN(priceRLT)) {
      skippedCount++
      continue
    }

    prices.push({ name: nameLine, priceRLT })
  }

  return { prices, skippedCount }
}
