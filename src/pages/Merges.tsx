import { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import SortDropdown, { type SortDropdownOption } from '../components/SortDropdown'
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
import {
  buildPartsOwnedMap,
  computeMergeNeeds,
  simulateMergeChain,
  type ChainSimulation,
  type MergeNeed,
  type PartNeed,
} from '../utils/computeMergeNeeds'
import {
  FORGE_LEVELS,
  getMergeLevelColor,
  getMinerLevelRarityName,
  getMinerPowerAtLevel,
  getRatioColor,
  partImagePath,
  partPriceKey,
  type CraftingPrices,
} from '../utils/minerMergeCalculator'
import { getDeepestConsumedRarity } from '../utils/partCrafting'
import { resolveAssetUrl } from '../utils/resolveAssetUrl'
import type { Miner, MinersData } from '../types/miner'

function formatRLT(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Nome de raridade oficial do minerador (Common/Uncommon/.../Unreal) em vez
// de "Nível N" -- getMinerLevelRarityName reaproveitada de
// minerMergeCalculator.ts, junto com getMergeLevelColor pra destacar o
// nível de DESTINO na mesma cor já usada nos badges de /mineradores/:slug.
function rarityLabel(level: number): string {
  return getMinerLevelRarityName(level)
}

function DestinationRarity({ level }: { level: number }) {
  return (
    <span className="font-bold" style={{ color: getMergeLevelColor(level) }}>
      {getMinerLevelRarityName(level)}
    </span>
  )
}

// Linha alternativa "ou craftando do seu estoque" abaixo de cada peça
// faltante -- reaproveita simulatePartCrafting (já calculado em
// PartNeed.craftAlternative por computeMergeNeeds.ts, sem duplicar aqui).
// null quando não falta nada ou quando não há nenhum estoque de raridade
// menor que ajude (nesse caso não faz sentido oferecer a opção).
function CraftAlternativeLine({ part }: { part: PartNeed }) {
  if (!part.craftAlternative) return null
  const deepest = getDeepestConsumedRarity(part.craftAlternative.consumedByRarity)
  if (!deepest) return null

  const usedLabel = partPriceKey(deepest.rarity, part.type)

  if (part.craftAlternative.fullyCraftable) {
    return (
      <p className="mt-0.5 text-[11px] text-slate-500">
        Ou craftando do seu estoque: {formatRLT(part.craftAlternative.totalRLTCost)} RLT (usa{' '}
        {deepest.quantity} {usedLabel})
      </p>
    )
  }

  const deficitLabel = part.craftAlternative.finalDeficitRarity
    ? partPriceKey(part.craftAlternative.finalDeficitRarity, part.type)
    : ''
  return (
    <p className="mt-0.5 text-[11px] text-amber-500">
      Ou craftando parcialmente: {formatRLT(part.craftAlternative.totalRLTCost)} RLT (usa{' '}
      {deepest.quantity} {usedLabel}) -- ainda faltariam {part.craftAlternative.finalDeficit}{' '}
      {deficitLabel}
    </p>
  )
}

type StatusFilter = 'ready' | 'parts-missing' | 'copies-missing'

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'ready', label: 'Prontos pra merge' },
  { key: 'parts-missing', label: 'Falta só peças' },
  { key: 'copies-missing', label: 'Mineradores não prontas' },
]

// Mesmas faixas de getRatioColor (verde < 1.5, laranja 1.5-3.0, vermelho >
// 3.0) reaproveitadas pro filtro de qualidade -- "Válidos" = verde ou
// laranja (exclui só o vermelho), "Ótimos" = só verde.
type QualityFilter = 'all' | 'valid' | 'great'

const QUALITY_TABS: { key: QualityFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'valid', label: 'Válidos' },
  { key: 'great', label: 'Ótimos' },
]

function passesQualityFilter(ratio: number, filter: QualityFilter): boolean {
  if (filter === 'great') return ratio < 1.5
  if (filter === 'valid') return ratio <= 3.0
  return true
}

type SortOption = 'padrao' | 'custo-beneficio'

const SORT_OPTIONS: SortDropdownOption<SortOption>[] = [
  { value: 'padrao', label: 'Nome (A-Z)' },
  { value: 'custo-beneficio', label: 'Custo-benefício' },
]

// Um passo da "Cadeia Completa" expandida -- mesmo estilo compacto dos
// cards principais, reaproveitando os campos já calculados por
// simulateMergeChain (cópias derivadas de merges anteriores, peças reais do
// inventário, ratio de qualidade).
function ChainStepRow({ step }: { step: ChainSimulation['steps'][number] }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5 text-xs">
      <div className="flex items-center justify-between font-semibold text-slate-200">
        <span>
          {rarityLabel(step.fromLevel)} -&gt; <DestinationRarity level={step.toLevel} />
        </span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
          style={{ backgroundColor: getRatioColor(step.ratioPower) }}
        >
          {step.ratioPower.toFixed(2)} RLT/Ph
        </span>
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-slate-400">Cópias</span>
        <span className={step.missingCopies > 0 ? 'text-red-400' : 'text-emerald-400'}>
          {step.availableCopies} / {step.requiredCopies}
          {step.missingCopies > 0 && ` (faltam ${step.missingCopies})`}
        </span>
      </div>

      {step.partsNeeded.map((p: PartNeed) => (
        <div key={`${p.rarity}-${p.type}`} className="mt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <img
                src={resolveAssetUrl(partImagePath(p.type, p.rarity))}
                alt={`${p.rarity} ${p.type}`}
                className="h-4 w-4 object-contain"
              />
              <span className="text-slate-300">
                {p.owned}/{p.needed}
              </span>
            </div>
            <span className={p.missing > 0 ? 'text-red-400' : 'text-emerald-400'}>
              {p.missing > 0 ? `faltam ${p.missing} (${formatRLT(p.missingCost)} RLT)` : 'completo'}
            </span>
          </div>
          <CraftAlternativeLine part={p} />
        </div>
      ))}

      <div className="mt-1 flex items-center justify-between">
        <span className="text-slate-400">Taxa de merge</span>
        <span className="text-slate-200">{formatRLT(step.mergeFeeCost)} RLT</span>
      </div>
    </div>
  )
}

// "Cadeia Completa" expandida -- lista todos os passos entre o nível atual
// e o máximo disponível (reaproveitando calculateMergeCostTable via
// simulateMergeChain), com o resumo (poder ganho, custo total teórico) no
// topo e o detalhe de cada passo abaixo.
function FullChain({
  miner,
  currentLevel,
  simulation,
}: {
  miner: Miner
  currentLevel: number
  simulation: ChainSimulation
}) {
  if (simulation.steps.length === 0) return null

  const last = simulation.steps[simulation.steps.length - 1]
  const currentPower = getMinerPowerAtLevel(miner, currentLevel)
  const powerGained = last.power - currentPower

  return (
    <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
      <div className="space-y-1 text-sm">
        <p className="text-xs text-slate-400">
          {rarityLabel(currentLevel)} -&gt; <DestinationRarity level={last.toLevel} /> (máximo)
        </p>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Poder final</span>
          <span className="text-white">{formatPower(last.power)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Ganho de poder</span>
          <span className="text-emerald-400">+{formatPower(powerGained)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Custo total acumulado</span>
          <span className="text-white">{formatRLT(last.finalCost)} RLT</span>
        </div>
      </div>

      <div className="space-y-1.5">
        {simulation.steps.map((step) => (
          <ChainStepRow key={step.toLevel} step={step} />
        ))}
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
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all')
  const [sortOption, setSortOption] = useState<SortOption>('padrao')
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

  const filteredMergeNeeds = useMemo(() => {
    const filtered = mergeNeeds.filter(
      (need) => need.status === statusFilter && passesQualityFilter(need.nextRatioPower, qualityFilter),
    )
    if (sortOption === 'custo-beneficio') {
      return [...filtered].sort((a, b) => a.nextRatioPower - b.nextRatioPower)
    }
    return filtered
  }, [mergeNeeds, statusFilter, qualityFilter, sortOption])

  const minersById = useMemo(() => {
    const map = new Map<string, Miner>()
    if (minersData) for (const m of minersData.miners) map.set(m.id, m)
    return map
  }, [minersData])

  const partsOwnedMap = useMemo(() => buildPartsOwnedMap(partsInventory), [partsInventory])

  // Simulação de "até onde dá pra subir só com as cópias já possuídas" --
  // alimenta tanto a frase de "Alcance Real" quanto a lista detalhada da
  // "Cadeia Completa" (mesmos dados, sem duplicar o cálculo).
  const chainSimulations = useMemo(() => {
    const map = new Map<string, ChainSimulation>()
    if (!craftingPrices) return map
    for (const need of mergeNeeds) {
      const miner = minersById.get(need.minerId)
      if (!miner) continue
      map.set(
        need.minerId,
        simulateMergeChain(
          miner,
          need.currentLevel,
          need.ownedAtCurrentLevel,
          partsOwnedMap,
          forgeDiscount,
          partPrices,
          craftingPrices,
        ),
      )
    }
    return map
  }, [mergeNeeds, minersById, partsOwnedMap, forgeDiscount, partPrices, craftingPrices])

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

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {QUALITY_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setQualityFilter(tab.key)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        qualityFilter === tab.key
                          ? 'bg-slate-600 text-white'
                          : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <SortDropdown options={SORT_OPTIONS} value={sortOption} onChange={setSortOption} />
                  {sortOption === 'custo-beneficio' && (
                    <p className="text-[10px] text-slate-500">
                      Custo-benefício isolado (sem considerar bônus de sala)
                    </p>
                  )}
                </div>
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
                              {rarityLabel(need.currentLevel)} -&gt;{' '}
                              <DestinationRarity level={need.nextLevel} />
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
                              <div key={`${p.rarity}-${p.type}`}>
                                <div className="flex items-center justify-between text-sm">
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
                                  <span
                                    className={p.missing > 0 ? 'text-red-400' : 'text-emerald-400'}
                                  >
                                    {p.missing > 0
                                      ? `faltam ${p.missing} (${formatRLT(p.missingCost)} RLT)`
                                      : 'completo'}
                                  </span>
                                </div>
                                <CraftAlternativeLine part={p} />
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

                        {(() => {
                          const simulation = chainSimulations.get(need.minerId)
                          if (
                            !simulation ||
                            need.ownedAtCurrentLevel <= 1 ||
                            simulation.totalMerges === 0
                          ) {
                            return null
                          }
                          const finalStep = simulation.steps.find(
                            (s) => s.toLevel === simulation.reachedLevel,
                          )
                          const finalStepPartsComplete = finalStep?.partsNeeded.every(
                            (p) => p.missing === 0,
                          )
                          return (
                            <div className="mt-3 border-t border-slate-800 pt-3 text-xs">
                              <p className="text-slate-300">
                                Com suas {need.ownedAtCurrentLevel} cópias hoje, dá pra fundir até{' '}
                                <DestinationRarity level={simulation.reachedLevel} /> (
                                {simulation.totalMerges}{' '}
                                {simulation.totalMerges === 1 ? 'merge' : 'merges'}, sobrando{' '}
                                {simulation.leftoverCopies}×), gastando{' '}
                                {formatRLT(simulation.totalFeeCost)} RLT em fusões (peças à parte).
                              </p>
                              {finalStep && (
                                <p
                                  className={`mt-1 ${finalStepPartsComplete ? 'text-emerald-400' : 'text-amber-400'}`}
                                >
                                  {finalStepPartsComplete
                                    ? 'Peças do passo final: completas.'
                                    : 'Peças do passo final: faltam peças no inventário.'}
                                </p>
                              )}
                            </div>
                          )
                        })()}

                        {miner && (
                          <div className="mt-3 border-t border-slate-800 pt-3">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(need.minerId)}
                              className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                            >
                              {isExpanded ? '- Ocultar cadeia completa' : '+ Ver cadeia completa'}
                            </button>
                            {isExpanded &&
                              (() => {
                                const simulation = chainSimulations.get(need.minerId)
                                if (!simulation) return null
                                return (
                                  <FullChain
                                    miner={miner}
                                    currentLevel={need.currentLevel}
                                    simulation={simulation}
                                  />
                                )
                              })()}
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
