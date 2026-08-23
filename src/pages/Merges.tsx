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
import { FORGE_LEVELS, partImagePath, type CraftingPrices } from '../utils/minerMergeCalculator'
import { resolveAssetUrl } from '../utils/resolveAssetUrl'
import type { MinersData } from '../types/miner'

function formatRLT(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function levelLabel(level: number): string {
  return level === 0 ? 'Base' : `Nível ${level}`
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {mergeNeeds.map((need) => (
                <div
                  key={need.minerId}
                  className={`rounded-lg border bg-slate-900 p-4 ${
                    need.ready ? 'border-emerald-500 ring-1 ring-emerald-500/40' : 'border-slate-700'
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
                    {need.ready && (
                      <span className="ml-auto rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-bold uppercase text-emerald-300">
                        Pronto
                      </span>
                    )}
                  </div>

                  <div className="mt-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Cópias</span>
                      <span className={need.missingCopies > 0 ? 'text-red-400' : 'text-emerald-400'}>
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
                </div>
              ))}
            </div>
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
