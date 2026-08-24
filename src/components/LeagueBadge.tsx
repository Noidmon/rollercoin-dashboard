import { useState } from 'react'

// Extraído de Dashboard.tsx pra ser reaproveitado também em /simulador
// (painel de stats da sala) -- mesmo componente, sem duplicar.
export default function LeagueBadge({
  src,
  size,
  active,
}: {
  src: string | null | undefined
  size: number
  active: boolean
}) {
  const [hidden, setHidden] = useState(false)

  if (!src || hidden) return null

  return (
    <img
      src={src}
      onError={() => setHidden(true)}
      width={size}
      height={size}
      className={`rounded-full border bg-slate-800 object-contain p-1 ${
        active ? 'border-indigo-400' : 'border-slate-700 opacity-70'
      }`}
    />
  )
}
