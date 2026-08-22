import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getCryptoPrices, COIN_SYMBOL_TO_COINGECKO_ID } from '../services/prices'
import type { CoinNetworkData } from '../utils/calculateEarnings'

interface NetworkDataContextValue {
  networkData: CoinNetworkData[] | null
  setNetworkData: (data: CoinNetworkData[] | null) => void
  prices: Record<string, number | null>
  pricesLoading: boolean
  pricesError: string | null
}

const NetworkDataContext = createContext<NetworkDataContextValue | null>(null)

// Compartilhado entre Calculadora (que importa/edita) e Dashboard (que só lê,
// ex: card "Melhor Moeda"), pra não duplicar o fetch de preços nem o import.
export function NetworkDataProvider({ children }: { children: ReactNode }) {
  const [networkData, setNetworkData] = useState<CoinNetworkData[] | null>(null)
  const [prices, setPrices] = useState<Record<string, number | null>>({})
  const [pricesLoading, setPricesLoading] = useState(true)
  const [pricesError, setPricesError] = useState<string | null>(null)

  useEffect(() => {
    getCryptoPrices(Object.values(COIN_SYMBOL_TO_COINGECKO_ID))
      .then(setPrices)
      .catch((err) => setPricesError(err instanceof Error ? err.message : String(err)))
      .finally(() => setPricesLoading(false))
  }, [])

  return (
    <NetworkDataContext.Provider
      value={{ networkData, setNetworkData, prices, pricesLoading, pricesError }}
    >
      {children}
    </NetworkDataContext.Provider>
  )
}

export function useNetworkData() {
  const context = useContext(NetworkDataContext)
  if (!context) {
    throw new Error('useNetworkData deve ser usado dentro de um NetworkDataProvider')
  }
  return context
}
