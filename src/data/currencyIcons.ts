import { withBase } from '../utils/withBase'

const SYMBOL_ALIASES: Record<string, string> = {
  MATIC: 'pol',
}

// Bug real corrigido (GitHub Pages, base path /rollercoin-dashboard/) --
// mesma classe do achado em hamsters.ts: caminho absoluto-raiz retornado
// por uma função de DADO, não um fetch/<img src> hardcoded no JSX, ficou
// fora da varredura anterior por isso.
export function getCurrencyIconPath(symbol: string): string {
  const normalized = SYMBOL_ALIASES[symbol.toUpperCase()] ?? symbol.toLowerCase()
  return withBase(`/currencies/${normalized}.svg`)
}
