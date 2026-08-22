import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Card from '../components/Card'
import { formatPower } from '../utils/formatPower'
import { parseMarketplacePaste } from '../utils/parseMarketplacePaste'
import { mergeStoredPartPrices, readStoredPartPrices } from '../utils/partPriceStorage'
import {
  FORGE_LEVELS,
  calculateMergeCostTable,
  getMergeLevelRarity,
  type CraftingPrices,
} from '../utils/minerMergeCalculator'
import type { Miner, MinersData } from '../types/miner'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
function toRoman(n: number): string {
  return ROMAN[n] ?? String(n)
}

function formatRLT(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function MineradorDetalhe() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [minersData, setMinersData] = useState<MinersData | null>(null)
  const [craftingPrices, setCraftingPrices] = useState<CraftingPrices | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Estado local -- reseta ao trocar de minerador, não persiste
  const [forgeLevel, setForgeLevel] = useState(1)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [priceRLT, setPriceRLT] = useState(0)
  const [priceUSD, setPriceUSD] = useState(0)
  const [pasteText, setPasteText] = useState('')
  const [pasteMessage, setPasteMessage] = useState<string | null>(null)

  // Estado persistente -- localStorage, sobrevive entre páginas/sessões
  const [partPrices, setPartPrices] = useState<Record<string, number>>(() => readStoredPartPrices())

  // Busca
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      fetch('/data/miners.json').then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json() as Promise<MinersData>
      }),
      fetch('/data/crafting-prices.json').then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json() as Promise<CraftingPrices>
      }),
    ])
      .then(([miners, crafting]) => {
        if (!cancelled) {
          setMinersData(miners)
          setCraftingPrices(crafting)
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setForgeLevel(1)
    setSelectedIndex(0)
    setPriceRLT(0)
    setPriceUSD(0)
    setPasteText('')
    setPasteMessage(null)
  }, [slug])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const miner: Miner | null = useMemo(() => {
    if (!minersData || !slug) return null
    return minersData.miners.find((m) => m.slug === slug) ?? null
  }, [minersData, slug])

  const sortedMerges = useMemo(() => {
    if (!miner) return []
    return [...miner.merges].sort((a, b) => a.level - b.level)
  }, [miner])

  const forgeDiscount = FORGE_LEVELS[forgeLevel - 1]?.discount ?? 0

  const costRows = useMemo(() => {
    if (!miner || !craftingPrices) return []
    return calculateMergeCostTable(miner, forgeDiscount, partPrices, craftingPrices)
  }, [miner, forgeDiscount, partPrices, craftingPrices])

  const bestRatioIndex = useMemo(() => {
    if (costRows.length === 0) return -1
    let bestIdx = 0
    for (let i = 1; i < costRows.length; i++) {
      if (costRows[i].ratioPower < costRows[bestIdx].ratioPower) bestIdx = i
    }
    return bestIdx
  }, [costRows])

  const searchMatches = useMemo(() => {
    if (!minersData) return []
    const term = searchQuery.trim().toLowerCase()
    if (!term) return []
    return minersData.miners.filter((m) => m.name.toLowerCase().includes(term)).slice(0, 8)
  }, [minersData, searchQuery])

  function handleSavePastedPrices() {
    if (!pasteText.trim()) return
    const parsed = parseMarketplacePaste(pasteText)
    if (parsed.length === 0) {
      setPasteMessage('Nenhum preço detectado no texto colado.')
      return
    }
    const priceMap: Record<string, number> = {}
    for (const p of parsed) priceMap[p.name] = p.priceRLT
    const merged = mergeStoredPartPrices(priceMap)
    setPartPrices(merged)
    setPasteMessage(`${parsed.length} preços detectados e salvos`)
  }

  if (loadError) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Minerador</h1>
        <p className="mt-4 text-sm text-red-400">Erro ao carregar dados: {loadError}</p>
      </div>
    )
  }

  if (!minersData || !craftingPrices) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Minerador</h1>
        <p className="mt-4 text-sm text-slate-400">Carregando...</p>
      </div>
    )
  }

  if (!miner) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Minerador não encontrado</h1>
        <p className="mt-4 text-sm text-slate-400">Não achamos nenhum minerador com o slug "{slug}".</p>
      </div>
    )
  }

  const selectedMerge = sortedMerges[selectedIndex] ?? null
  const selectedRow = costRows[selectedIndex] ?? null
  const selectedRarity = selectedMerge ? getMergeLevelRarity(selectedMerge) : null

  return (
    <div>
      {/* Seção 1: busca + navegação */}
      <div ref={searchRef} className="relative max-w-md">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setSearchOpen(true)
          }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Buscar outro minerador..."
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {searchOpen && searchMatches.length > 0 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-800 shadow-lg">
            {searchMatches.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  navigate(`/mineradores/${m.slug}`)
                  setSearchQuery('')
                  setSearchOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 hover:text-white"
              >
                {m.image && <img src={m.image} alt="" className="h-6 w-6 shrink-0 object-contain" />}
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          {/* Nível da Forja */}
          <Card title="Nível da Forja">
            <select
              value={forgeLevel}
              onChange={(e) => setForgeLevel(Number(e.target.value))}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {FORGE_LEVELS.map((fl) => (
                <option key={fl.level} value={fl.level}>
                  Nível {fl.level} ({Math.round(fl.discount * 100)}%)
                </option>
              ))}
            </select>
          </Card>

          {/* Seção 2: card do minerador base */}
          <Card title={miner.name}>
            <div className="flex flex-col items-center gap-2">
              {miner.image ? (
                <img
                  src={miner.image}
                  alt={miner.name}
                  className="h-32 w-32 object-contain"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center text-slate-600">?</div>
              )}
              <span className="text-sm text-slate-400">Células: {miner.cells}</span>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Preço em RLT</label>
                <input
                  type="number"
                  value={priceRLT}
                  onChange={(e) => setPriceRLT(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Preço em USD</label>
                <input
                  type="number"
                  value={priceUSD}
                  onChange={(e) => setPriceUSD(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <a
              href={miner.marketplaceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-indigo-500"
            >
              Marketplace ↗
            </a>
          </Card>

          {/* Seção 3: colar texto do marketplace */}
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
        </div>

        <div className="space-y-4">
          {/* Aviso fixo */}
          <div className="rounded-md border border-yellow-600 bg-yellow-500/20 px-4 py-3 text-center text-sm font-medium text-yellow-200">
            Ratios recomendados: Poder &lt;1.5 por Ph e Crypto &lt;0.45$ por Ph. Priorize sempre o
            menor valor.
          </div>

          {sortedMerges.length === 0 ? (
            <Card title="Merges">
              <p className="text-sm text-slate-400">
                Este minerador não possui níveis de merge disponíveis.
              </p>
            </Card>
          ) : (
            <>
              {/* Seção 4: card de detalhe do nível selecionado */}
              <Card title={miner.name}>
                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
                    disabled={selectedIndex === 0}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-white disabled:opacity-40"
                  >
                    ◄
                  </button>

                  <div className="flex-1 text-center">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Nível {selectedMerge ? toRoman(selectedMerge.level) : '--'}
                      {selectedRarity ? ` -- ${selectedRarity}` : ''}
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">Poder Base</p>
                        <p className="font-semibold text-white">
                          {selectedMerge ? formatPower(selectedMerge.power) : '--'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Bônus Base</p>
                        <p className="font-semibold text-white">
                          {selectedMerge ? `${selectedMerge.bonus}%` : '--'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Ratio Poder</p>
                        <p className="font-semibold text-white">
                          {selectedRow ? `${formatRLT(selectedRow.ratioPower)} RLT` : '--'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIndex((i) => Math.min(sortedMerges.length - 1, i + 1))
                    }
                    disabled={selectedIndex === sortedMerges.length - 1}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-white disabled:opacity-40"
                  >
                    ►
                  </button>
                </div>
              </Card>

              {/* Seção 5: tabela de custos de merge */}
              <Card title="Custos de Merge">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs uppercase text-slate-400">
                        <th className="py-2 pr-3 font-medium">LVL</th>
                        <th className="py-2 pr-3 font-medium">Peças</th>
                        <th className="py-2 pr-3 font-medium">Custo de Todas as Peças</th>
                        <th className="py-2 pr-3 font-medium">Taxa de Merge</th>
                        <th className="py-2 pr-3 font-medium">Peças + Taxa</th>
                        <th className="py-2 pr-3 font-medium">Poder</th>
                        <th className="py-2 pr-3 font-medium">Bônus</th>
                        <th className="py-2 pr-3 font-medium">Custo Final</th>
                        <th className="py-2 pr-3 font-medium">Ratio Poder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costRows.map((row, i) => (
                        <tr
                          key={row.merge.mergeId}
                          onClick={() => setSelectedIndex(i)}
                          className={`cursor-pointer border-b border-slate-800/60 ${
                            i === bestRatioIndex
                              ? 'bg-emerald-600/40 text-white'
                              : i === selectedIndex
                                ? 'bg-indigo-500/10'
                                : 'hover:bg-slate-800/60'
                          }`}
                        >
                          <td className="py-2 pr-3 text-slate-200">{toRoman(row.merge.level)}</td>
                          <td className="py-2 pr-3 text-slate-300">x{row.totalPieces}</td>
                          <td className="py-2 pr-3 text-slate-200">{formatRLT(row.piecesCost)} RLT</td>
                          <td className="py-2 pr-3 text-slate-200">
                            {formatRLT(row.mergeFeeCost)} RLT
                          </td>
                          <td className="py-2 pr-3 text-slate-200">
                            {formatRLT(row.piecesPlusFee)} RLT
                          </td>
                          <td className="py-2 pr-3 text-slate-200">
                            {formatPower(row.merge.power)}
                          </td>
                          <td className="py-2 pr-3 text-slate-200">{row.merge.bonus}%</td>
                          <td className="py-2 pr-3 font-semibold text-slate-100">
                            {formatRLT(row.finalCost)} RLT
                          </td>
                          <td className="py-2 pr-3 font-semibold text-slate-100">
                            {formatRLT(row.ratioPower)} RLT
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
