import { useState } from 'react'
import Card from './Card'
import { parseMarketplacePaste } from '../utils/parseMarketplacePaste'
import { mergeStoredPartPrices } from '../utils/partPriceStorage'

// Card "Colar texto do marketplace" pra atualizar preço de peças
// (localStorage "rc-part-prices") -- reaproveitado em /mineradores/:slug e
// /merges, sem duplicar o parser/merge de preços em cada página.
export default function PartPricesPasteCard({
  onPricesSaved,
}: {
  onPricesSaved: (merged: Record<string, number>) => void
}) {
  const [pasteText, setPasteText] = useState('')
  const [pasteMessage, setPasteMessage] = useState<string | null>(null)

  function handleSavePastedPrices() {
    if (!pasteText.trim()) return
    const { prices: parsed, skippedCount } = parseMarketplacePaste(pasteText)
    if (parsed.length === 0) {
      setPasteMessage('Nenhum preço detectado no texto colado.')
      return
    }
    const priceMap: Record<string, number> = {}
    for (const p of parsed) priceMap[p.name] = p.priceRLT
    const merged = mergeStoredPartPrices(priceMap)
    onPricesSaved(merged)
    setPasteMessage(
      skippedCount > 0
        ? `${parsed.length} preços detectados e salvos (${skippedCount} ignorados)`
        : `${parsed.length} preços detectados e salvos`,
    )
  }

  return (
    <Card title="Preço das Peças">
      <label className="mb-1 block text-xs text-slate-400">Colar texto do marketplace</label>
      <textarea
        value={pasteText}
        onChange={(e) => setPasteText(e.target.value)}
        placeholder="Cole aqui"
        rows={6}
        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        type="button"
        onClick={handleSavePastedPrices}
        className="mt-2 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        Salvar preços colados
      </button>
      {pasteMessage && <p className="mt-2 text-xs text-emerald-400">{pasteMessage}</p>}
    </Card>
  )
}
