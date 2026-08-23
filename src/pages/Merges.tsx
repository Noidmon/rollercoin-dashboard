import { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import { formatPower } from '../utils/formatPower'
import { parseMinersInventory } from '../utils/parseMinersInventory'
import { parsePartsInventory } from '../utils/parsePartsInventory'
import { matchMinersInventory, type MatchedMinerEntry } from '../utils/matchMinersInventory'
import type { MinerInventoryEntry } from '../utils/parseMinersInventory'
import type { PartInventoryEntry } from '../utils/parsePartsInventory'
import {
  readMinersInventory,
  readPartsInventory,
  readRealForgeLevel,
  writeMinersInventory,
  writePartsInventory,
  writeRealForgeLevel,
} from '../utils/mergesStorage'
import { readStoredPartPrices } from '../utils/partPriceStorage'
import { computeMergeNeeds, type MergeNeed } from '../utils/computeMergeNeeds'
import {
  FORGE_LEVELS,
  calculateMergeCostTable,
  getRatioColor,
  partImagePath,
  type CraftingPrices,
} from '../utils/minerMergeCalculator'
import { resolveAssetUrl } from '../utils/resolveAssetUrl'
import type { Miner, MinersData } from '../types/miner'

function formatRLT(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function levelLabel(level: number): string {
  return level === 0 ? 'Base' : `Nível ${level}`
}

type StatusFilter = 'ready' | 'parts-missing' | 'copies-missing'

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'ready', label: 'Prontos pra merge' },
  { key: 'parts-missing', label: 'Falta só peças' },
  { key: 'copies-missing', label: 'Mineradores não prontas' },
]

// Sub-componente da "Cadeia Completa" -- reaproveita calculateMergeCostTable
// (mesma fórmula recursiva de finalCost de /mineradores/:slug) a partir do
// nível já possuído, assumindo que as cópias intermediárias vêm de merges
// anteriores dentro dessa mesma cadeia (não de compra avulsa).
function FullChain({
  miner,
  currentLevel,
  forgeDiscount,
  partPrices,
  craftingPrices,
}: {
  miner: Miner
  currentLevel: number
  forgeDiscount: number
  partPrices: Record<string, number>
  craftingPrices: CraftingPrices
}) {
  const chain = calculateMergeCostTable(miner, forgeDiscount, partPrices, craftingPrices, {
    fromLevel: currentLevel,
  })

  if (chain.length === 0) return null

  const last = chain[chain.length - 1]
  const totalCost = last.finalCost

  return (
    <div className="mt-3 space-y-1.5 border-t border-slate-800 pt-3 text-sm">
      <p className="text-xs text-slate-400">
        Nível {currentLevel === 0 ? 'Base' : currentLevel} -&gt; Nível {last.merge.level} (máximo)
      </p>
      <div className="flex items-center justify-between">
        <span className="text-slate-400">Poder final</span>
        <span className="text-white">{formatPower(last.merge.power)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-400">Custo total acumulado</span>
        <span className="text-white">{formatRLT(totalCost)} RLT</span>
      </div>
    </div>
  )
}

export default function Merges() {
  const [minersData, setMinersData] = useState<MinersData | null>(null)
  const [craftingPrices, setCraftingPrices] = useState<CraftingPrices | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [minersPasteText, setMinersPasteText] = useState('')
  const [partsPasteText, setPartsPasteText] = useState('')
  const [analyzeMessage, setAnalyzeMessage] = useState<string | null>(null)

  // Estado persistente -- localStorage, sobrevive entre sessões
  const [minersInventory, setMinersInventory] = useState<MatchedMinerEntry[]>(() =>
    readMinersInventory(),
  )
  const [partsInventory, setPartsInventory] = useState<PartInventoryEntry[]>(() =>
    readPartsInventory(),
  )
  const [unrecognized, setUnrecognized] = useState<MinerInventoryEntry[]>([])
  const [realForgeLevel, setRealForgeLevel] = useState<number>(() => readRealForgeLevel())
  const [partPrices] = useState<Record<string, number>>(() => readStoredPartPrices())
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ready')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())

  function toggleExpanded(minerId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(minerId)) next.delete(minerId)
      else next.add(minerId)
      return next
    })
  }

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

  function handleForgeLevelChange(level: number) {
    setRealForgeLevel(level)
    writeRealForgeLevel(level)
  }

  function handleAnalyze() {
    if (!minersData) return

    const parsedMiners = parseMinersInventory(minersPasteText)
    const parsedParts = parsePartsInventory(partsPasteText)
    const { matched, unrecognized: newUnrecognized } = matchMinersInventory(
      parsedMiners,
      minersData.miners,
    )

    setMinersInventory(matched)
    writeMinersInventory(matched)
    setPartsInventory(parsedParts)
    writePartsInventory(parsedParts)
    setUnrecognized(newUnrecognized)

    setAnalyzeMessage(
      `${matched.length} entradas de mineradores reconhecidas, ${parsedParts.length} tipos de peça, ` +
        `${newUnrecognized.length} não reconhecidas`,
    )
  }

  const forgeDiscount = FORGE_LEVELS[realForgeLevel - 1]?.discount ?? 0

  const mergeNeeds = useMemo<MergeNeed[]>(() => {
    if (!minersData || !craftingPrices) return []
    return computeMergeNeeds(
      minersInventory,
      minersData.miners,
      partsInventory,
      forgeDiscount,
      partPrices,
      craftingPrices,
    )
  }, [minersInventory, minersData, partsInventory, forgeDiscount, partPrices, craftingPrices])

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      ready: 0,
      'parts-missing': 0,
      'copies-missing': 0,
    }
    for (const need of mergeNeeds) counts[need.status]++
    return counts
  }, [mergeNeeds])

  const filteredMergeNeeds = useMemo(
    () => mergeNeeds.filter((need) => need.status === statusFilter),
    [mergeNeeds, statusFilter],
  )

  const minersById = useMemo(() => {
    const map = new Map<string, Miner>()
    if (minersData) for (const m of minersData.miners) map.set(m.id, m)
    return map
  }, [minersData])

  if (loadError) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Merges</h1>
        <p className="mt-4 text-sm text-red-400">Erro ao carregar dados: {loadError}</p>
      </div>
    )
  }

  if (!minersData || !craftingPrices) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Merges</h1>
        <p className="mt-4 text-sm text-slate-400">Carregando...</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Merges</h1>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card title="Nível da Forja">
            <select
              value={realForgeLevel}
              onChange={(e) => handleForgeLevelChange(Number(e.target.value))}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {FORGE_LEVELS.map((fl) => (
                <option key={fl.level} value={fl.level}>
                  Nível {fl.level} ({Math.round(fl.discount * 100)}%)
                </option>
              ))}
            </select>
          </Card>

          <Card title="Inventário de Mineradores">
            <label className="mb-1 block text-xs text-slate-400">
              Colar inventário de mineradores
            </label>
            <textarea
              value={minersPasteText}
              onChange={(e) => setMinersPasteText(e.target.value)}
              placeholder="Cole aqui"
              rows={8}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Card>

          <Card title="Inventário de Peças">
            <label className="mb-1 block text-xs text-slate-400">Colar inventário de peças</label>
            <textarea
              value={partsPasteText}
              onChange={(e) => setPartsPasteText(e.target.value)}
              placeholder="Cole aqui"
              rows={8}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Card>

          <button
            type="button"
            onClick={handleAnalyze}
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Analisar Inventário
          </button>
          {analyzeMessage && <p className="text-xs text-emerald-400">{analyzeMessage}</p>}
        </div>

        <div className="space-y-4">
          {mergeNeeds.length === 0 ? (
            <Card title="Próximos Merges">
              <p className="text-sm text-slate-400">
                Cole seu inventário de mineradores e peças ao lado e clique em "Analisar
                Inventário" pra ver quais mineradores estão prontos (ou quase) pro próximo merge.
              </p>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusFilter(tab.key)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      statusFilter === tab.key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {tab.label} ({statusCounts[tab.key]})
                  </button>
                ))}
              </div>

              {filteredMergeNeeds.length === 0 ? (
                <Card title="Próximos Merges">
                  <p className="text-sm text-slate-400">Nenhum minerador nessa categoria.</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredMergeNeeds.map((need) => {
                    const isExpanded = expandedIds.has(need.minerId)
                    const miner = minersById.get(need.minerId)
                    return (
                      <div
                        key={need.minerId}
                        className={`rounded-lg border bg-slate-900 p-4 ${
                          need.ready
                            ? 'border-emerald-500 ring-1 ring-emerald-500/40'
                            : 'border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {need.minerImage ? (
                            <img
                              src={need.minerImage}
                              alt={need.minerName}
                              className="h-12 w-12 shrink-0 object-contain"
                            />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center text-slate-600">
                              ?
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-white">{need.minerName}</p>
                            <p className="text-xs text-slate-400">
                              {levelLabel(need.currentLevel)} -&gt; Nível {need.nextLevel}
                            </p>
                          </div>
                          <div className="ml-auto flex flex-col items-end gap-1">
                            {need.ready && (
                              <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-bold uppercase text-emerald-300">
                                Pronto
                              </span>
                            )}
                            <span
                              className="rounded-full px-2 py-1 text-[10px] font-bold text-white"
                              style={{ backgroundColor: getRatioColor(need.nextRatioPower) }}
                              title="Qualidade do próximo merge (custo por Ph/s)"
                            >
                              {need.nextRatioPower.toFixed(2)} RLT/Ph
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Cópias</span>
                            <span
                              className={need.missingCopies > 0 ? 'text-red-400' : 'text-emerald-400'}
                            >
                              {need.ownedAtCurrentLevel} / {need.requiredCopies}
                              {need.missingCopies > 0 && ` (faltam ${need.missingCopies})`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Taxa de merge</span>
                            <span className="text-slate-200">{formatRLT(need.mergeFeeCost)} RLT</span>
                          </div>
                        </div>

                        {need.partsNeeded.length > 0 && (
                          <div className="mt-3 space-y-1.5 border-t border-slate-800 pt-3">
                            {need.partsNeeded.map((p) => (
                              <div
                                key={`${p.rarity}-${p.type}`}
                                className="flex items-center justify-between text-sm"
                              >
                                <div className="flex items-center gap-2">
                                  <img
                                    src={resolveAssetUrl(partImagePath(p.type, p.rarity))}
                                    alt={`${p.rarity} ${p.type}`}
                                    className="h-5 w-5 object-contain"
                                  />
                                  <span className="text-slate-300">
                                    {p.owned}/{p.needed}
                                  </span>
                                </div>
                                <span className={p.missing > 0 ? 'text-red-400' : 'text-emerald-400'}>
                                  {p.missing > 0
                                    ? `faltam ${p.missing} (${formatRLT(p.missingCost)} RLT)`
                                    : 'completo'}
                                </span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between border-t border-slate-800 pt-1.5 text-sm font-semibold">
                              <span className="text-slate-300">Custo peças faltando</span>
                              <span className="text-white">
                                {formatRLT(need.totalMissingPartsCost)} RLT
                              </span>
                            </div>
                          </div>
                        )}

                        {miner && (
                          <div className="mt-3 border-t border-slate-800 pt-3">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(need.minerId)}
                              className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                            >
                              {isExpanded ? '- Ocultar cadeia completa' : '+ Ver cadeia completa'}
                            </button>
                            {isExpanded && (
                              <FullChain
                                miner={miner}
                                currentLevel={need.currentLevel}
                                forgeDiscount={forgeDiscount}
                                partPrices={partPrices}
                                craftingPrices={craftingPrices}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {unrecognized.length > 0 && (
            <Card title={`Entradas não reconhecidas (${unrecognized.length})`}>
              <p className="mb-2 text-xs text-slate-400">
                Essas entradas do inventário colado não bateram com nenhum minerador/nível
                conhecido. Confira se o texto colado está completo.
              </p>
              <ul className="max-h-64 space-y-1 overflow-y-auto text-xs text-slate-300">
                {unrecognized.map((entry, i) => (
                  <li key={i}>
                    {entry.name} -- {formatPower(entry.powerValue)}, {entry.bonusPercent}% bônus,
                    x{entry.quantity}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
