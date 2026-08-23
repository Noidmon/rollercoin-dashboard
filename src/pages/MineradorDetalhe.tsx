import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Card from '../components/Card'
import MinerStatusIcons from '../components/MinerStatusIcons'
import PartPricesPasteCard from '../components/PartPricesPasteCard'
import { formatPower } from '../utils/formatPower'
import { readStoredPartPrices } from '../utils/partPriceStorage'
import { resolveAssetUrl } from '../utils/resolveAssetUrl'
import {
  FORGE_LEVELS,
  calculateMergeCostTable,
  getMergeLevelColor,
  getMergeLevelRarity,
  getRatioColor,
  partImagePath,
  type ActivePart,
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

// Alpha aplicado sobre as cores exatas de nível (hex de 6 dígitos + alpha de
// 2 dígitos = hex de 8 dígitos, suportado em todos os browsers evergreen).
function levelColorWithAlpha(level: number, alphaHex: string): string {
  return `${getMergeLevelColor(level)}${alphaHex}`
}

function LevelBadge({ level }: { level: number }) {
  const [imgFailed, setImgFailed] = useState(false)

  if (imgFailed) {
    return (
      <span
        className="flex h-6 w-7 items-center justify-center rounded text-[10px] font-bold text-white"
        style={{ backgroundColor: getMergeLevelColor(level) }}
      >
        {toRoman(level)}
      </span>
    )
  }

  return (
    <img
      src={resolveAssetUrl(`rollercoin/levels/level_${level}.webp`)}
      alt={toRoman(level)}
      onError={() => setImgFailed(true)}
      className="h-6 w-7 object-contain"
    />
  )
}

function PartsCell({ parts }: { parts: ActivePart[] }) {
  if (parts.length === 0) return <span className="text-slate-500">--</span>

  return (
    <div className="flex flex-wrap items-center gap-2">
      {parts.map((p) => (
        <div key={p.type} className="relative h-8 w-8 shrink-0">
          <img
            src={resolveAssetUrl(partImagePath(p.type, p.rarity))}
            alt={`${p.rarity} ${p.type}`}
            className="h-8 w-8 object-contain"
          />
          <span className="absolute -bottom-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-black px-1 text-[9px] font-bold leading-none text-white">
            x{p.count}
          </span>
        </div>
      ))}
    </div>
  )
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

  const searchMatches = useMemo(() => {
    if (!minersData) return []
    const term = searchQuery.trim().toLowerCase()
    if (!term) return []
    return minersData.miners.filter((m) => m.name.toLowerCase().includes(term)).slice(0, 8)
  }, [minersData, searchQuery])

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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          {/* Busca -- só acima da coluna esquerda, mesma largura dela, lado
              a lado com o aviso da coluna direita (igual à referência) */}
          <div ref={searchRef} className="relative">
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
                    {m.image && (
                      <img src={m.image} alt="" className="h-6 w-6 shrink-0 object-contain" />
                    )}
                    <span>{m.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

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

          {/* Card do minerador base -- imagem/células/preços + nível
              selecionado (navegável) + marketplace, tudo em um card só,
              igual à referência */}
          <Card title={miner.name}>
            <div className="flex flex-col items-center gap-2">
              <div className="relative h-32 w-32">
                <div className="absolute right-0 top-0 z-10 flex gap-1">
                  <MinerStatusIcons sellable={miner.sellable} mergeable={miner.mergeable} />
                </div>
                {miner.image ? (
                  <img
                    src={miner.image}
                    alt={miner.name}
                    className="h-32 w-32 object-contain"
                  />
                ) : (
                  <div className="flex h-32 w-32 items-center justify-center text-slate-600">?</div>
                )}
              </div>
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

            {sortedMerges.length > 0 && (
              <div className="mt-4 border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
                    disabled={selectedIndex === 0}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-white disabled:opacity-40"
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
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-white disabled:opacity-40"
                  >
                    ►
                  </button>
                </div>
              </div>
            )}

            <a
              href={miner.marketplaceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-indigo-500"
            >
              Marketplace ↗
            </a>
          </Card>

          <PartPricesPasteCard onPricesSaved={setPartPrices} />
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
            <Card title="Custos de Merge">
              <div className="overflow-x-auto rounded-md">
                <table className="w-full border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="border-t-4 border-t-yellow-500 bg-slate-900 text-xs uppercase text-slate-300">
                      <th className="border border-white/10 px-3 py-2 font-medium">LVL</th>
                      <th className="border border-white/10 px-3 py-2 font-medium">Peças</th>
                      <th className="border border-white/10 px-3 py-2 font-medium">
                        Custo de Todas as Peças
                      </th>
                      <th className="border border-white/10 px-3 py-2 font-medium">Taxa de Merge</th>
                      <th className="border border-white/10 px-3 py-2 font-medium">Peças + Taxa</th>
                      <th className="border border-white/10 px-3 py-2 font-medium">Poder</th>
                      <th className="border border-white/10 px-3 py-2 font-medium">Bônus</th>
                      <th className="border border-white/10 px-3 py-2 font-medium">Custo Final</th>
                      <th className="border border-white/10 px-3 py-2 font-medium">Ratio Poder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costRows.map((row, i) => (
                      <tr
                        key={row.merge.mergeId}
                        onClick={() => setSelectedIndex(i)}
                        className={`cursor-pointer ${
                          i === selectedIndex ? 'ring-2 ring-inset ring-white/70' : ''
                        }`}
                      >
                        <td
                          className="border border-white/10 px-3 py-2"
                          style={{ backgroundColor: levelColorWithAlpha(row.merge.level, 'E6') }}
                        >
                          <LevelBadge level={row.merge.level} />
                        </td>
                        <td
                          className="border border-white/10 px-3 py-2"
                          style={{ backgroundColor: levelColorWithAlpha(row.merge.level, 'E6') }}
                        >
                          <PartsCell parts={row.activeParts} />
                        </td>
                        <td
                          className="border border-white/10 px-3 py-2"
                          style={{ backgroundColor: levelColorWithAlpha(row.merge.level, 'E6') }}
                        >
                          <span className="inline-block whitespace-nowrap rounded-full bg-slate-950/55 px-2 py-1 text-xs font-semibold text-white">
                            {formatRLT(row.piecesCost)} RLT
                          </span>
                        </td>
                        <td
                          className="border border-white/10 px-3 py-2 text-slate-100"
                          style={{ backgroundColor: levelColorWithAlpha(row.merge.level, 'E6') }}
                        >
                          {formatRLT(row.mergeFeeCost)} RLT
                        </td>
                        <td
                          className="border border-white/10 px-3 py-2 text-slate-100"
                          style={{ backgroundColor: levelColorWithAlpha(row.merge.level, 'E6') }}
                        >
                          {formatRLT(row.piecesPlusFee)} RLT
                        </td>
                        <td
                          className="border border-white/10 px-3 py-2 text-slate-100"
                          style={{ backgroundColor: levelColorWithAlpha(row.merge.level, 'E6') }}
                        >
                          {formatPower(row.merge.power)}
                        </td>
                        <td
                          className="border border-white/10 px-3 py-2 text-slate-100"
                          style={{ backgroundColor: levelColorWithAlpha(row.merge.level, 'E6') }}
                        >
                          {row.merge.bonus}%
                        </td>
                        <td
                          className="border border-white/10 px-3 py-2 font-semibold text-white"
                          style={{ backgroundColor: levelColorWithAlpha(row.merge.level, 'E6') }}
                        >
                          {formatRLT(row.finalCost)} RLT
                        </td>
                        <td
                          className="border border-white/10 px-3 py-2 font-semibold text-white"
                          style={{ backgroundColor: `${getRatioColor(row.ratioPower)}E6` }}
                        >
                          {formatRLT(row.ratioPower)} RLT
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
