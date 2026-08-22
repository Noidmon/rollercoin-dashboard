// Parseia texto colado do marketplace do RollerCoin: uma sequência de links
// markdown repetidos em grupos de 4 por peça --
//   [Nome da Peça](url)
//   [Quantity: N](url)
//   [From](url)
//   [X RLT](url) ou [X.XX RLT](url)
// Quantity e From são ignorados, só extraímos {nome, preçoRLT} de cada grupo.

export interface ParsedPartPrice {
  name: string
  priceRLT: number
}

const LINK_TEXT_PATTERN = /\[(.*?)\]\(.*?\)/g
const PRICE_PATTERN = /^([\d.]+)\s*RLT$/i

export function parseMarketplacePaste(raw: string): ParsedPartPrice[] {
  const linkTexts = [...raw.matchAll(LINK_TEXT_PATTERN)].map((m) => m[1].trim())
  const results: ParsedPartPrice[] = []

  for (let i = 0; i + 3 < linkTexts.length; i += 4) {
    const name = linkTexts[i]
    const priceText = linkTexts[i + 3]
    const priceMatch = priceText.match(PRICE_PATTERN)
    if (!name || !priceMatch) continue

    const priceRLT = Number(priceMatch[1])
    if (Number.isNaN(priceRLT)) continue

    results.push({ name, priceRLT })
  }

  return results
}
