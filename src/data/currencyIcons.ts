const SYMBOL_ALIASES: Record<string, string> = {
  MATIC: 'pol',
}

export function getCurrencyIconPath(symbol: string): string {
  const normalized = SYMBOL_ALIASES[symbol.toUpperCase()] ?? symbol.toLowerCase()
  return `/currencies/${normalized}.svg`
}
