export const COIN_SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  XRP: 'ripple',
  LTC: 'litecoin',
  DOGE: 'dogecoin',
  TRX: 'tron',
  ALGO: 'algorand',
  MATIC: 'polygon-ecosystem-token',
  SOL: 'solana',
  USDT: 'tether',
}

export async function getCryptoPrices(
  coinIds: string[],
): Promise<Record<string, number | null>> {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd`,
  )

  if (!response.ok) {
    throw new Error(`Falha ao buscar preços de cripto (${response.status})`)
  }

  const data: Record<string, { usd?: number }> = await response.json()

  const prices: Record<string, number | null> = {}
  for (const id of coinIds) {
    prices[id] = data[id]?.usd ?? null
  }
  return prices
}
