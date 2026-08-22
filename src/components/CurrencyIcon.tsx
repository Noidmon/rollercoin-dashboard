import { useState } from 'react'
import { getCurrencyIconPath } from '../data/currencyIcons'

export default function CurrencyIcon({ symbol }: { symbol: string }) {
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  return (
    <img
      src={getCurrencyIconPath(symbol)}
      alt={symbol}
      loading="lazy"
      onError={() => setHidden(true)}
      className="h-4 w-4 shrink-0"
    />
  )
}
