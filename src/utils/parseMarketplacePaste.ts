// Parseia texto colado do marketplace do RollerCoin: uma sequência repetida
// em grupos de 4 linhas por peça. O formato REAL (o que o usuário realmente
// cola ao selecionar/copiar da tela do jogo) é texto puro, sem colchetes nem
// links:
//   Common Hashboard
//   Quantity: 2 878 690
//   From
//   0.021 RLT
// Também aceita o formato com links markdown (caso apareça em algum
// contexto), onde cada linha vem como [texto](url) -- extrai só o texto:
//   [Nome da Peça](url)
//   [Quantity: N](url)
//   [From](url)
//   [X RLT](url) ou [X.XX RLT](url)
// Quantity e From são ignorados, só extraímos {nome, preçoRLT} de cada grupo.

export interface ParsedPartPrice {
  name: string
  priceRLT: number
}

const MARKDOWN_LINK_LINE_PATTERN = /^\[(.*)\]\(.*\)$/
const PRICE_PATTERN = /^([\d.]+)\s*RLT$/i

function extractLineValue(line: string): string {
  const match = line.match(MARKDOWN_LINK_LINE_PATTERN)
  return (match ? match[1] : line).trim()
}

export function parseMarketplacePaste(raw: string): ParsedPartPrice[] {
  const lines = raw
    .split('\n')
    .map(extractLineValue)
    .filter((line) => line.length > 0)

  const results: ParsedPartPrice[] = []

  for (let i = 0; i + 3 < lines.length; i += 4) {
    const name = lines[i]
    const priceText = lines[i + 3]
    const priceMatch = priceText.match(PRICE_PATTERN)
    if (!name || !priceMatch) continue

    const priceRLT = Number(priceMatch[1])
    if (Number.isNaN(priceRLT)) continue

    results.push({ name, priceRLT })
  }

  return results
}
