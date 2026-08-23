import { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import PartPricesPasteCard from '../components/PartPricesPasteCard'
import SortDropdown, { type SortDropdownOption } from '../components/SortDropdown'
import { formatPower } from '../utils/formatPower'
import { parseMinersInventory } from '../utils/parseMinersInventory'
import { parsePartsInventory } from '../utils/parsePartsInventory'
import {
  matchMinersInventory,
  matchRoomMinerInstances,
  type MatchedMinerEntry,
  type ResolvedRoomMinerInstance,
} from '../utils/matchMinersInventory'
import { computeRoomMergeImpact, type RoomMergeImpact } from '../utils/roomMergeImpact'
import type { Miner as RoomMiner, Rack } from '../utils/calculatePower'
import type { MinerInventoryEntry } from '../utils/parseMinersInventory'
import type { PartInventoryEntry } from '../utils/parsePartsInventory'
import { clearLegacyInventoryKeys, readRealForgeLevel, writeRealForgeLevel } from '../utils/mergesStorage'
import { readStoredPartPrices } from '../utils/partPriceStorage'
import {
  buildOwnedByNameLevelMap,
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
  type PartType,
} from '../utils/minerMergeCalculator'
import { getDeepestConsumedRarity } from '../utils/partCrafting'
import { resolveAssetUrl } from '../utils/resolveAssetUrl'
import { usePlayer } from '../context/PlayerContext'
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

// Linha "atual -> próximo (+ganho)" de Poder e Bônus -- usada tanto no
// cabeçalho do card principal quanto em cada passo da Cadeia Completa
// (mesmo componente, sem duplicar o formato). Verde no valor de destino e
// no ganho, mesmo padrão de "Ganho de poder" já usado no resumo da cadeia.
function PowerBonusLine({
  fromPower,
  toPower,
  fromBonus,
  toBonus,
}: {
  fromPower: number
  toPower: number
  fromBonus: number
  toBonus: number
}) {
  return (
    <div className="mt-2 space-y-0.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-slate-400">Poder</span>
        <span className="text-slate-300">
          {formatPower(fromPower)} -&gt;{' '}
          <span className="font-semibold text-emerald-400">{formatPower(toPower)}</span>{' '}
          <span className="text-emerald-400">(+{formatPower(toPower - fromPower)})</span>
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-400">Bônus</span>
        <span className="text-slate-300">
          {fromBonus}% -&gt; <span className="font-semibold text-emerald-400">{toBonus}%</span>{' '}
          {/* toFixed(4)+Number sanitiza ruído de ponto flutuante da subtração
          (ex: 0.8 - 0.5 = 0.30000000000000004) sem arredondar de verdade,
          já que bônus reais nunca têm mais de 2-3 casas decimais. */}
          <span className="text-emerald-400">
            (+{Number((toBonus - fromBonus).toFixed(4))}%)
          </span>
        </span>
      </div>
    </div>
  )
}

// Aviso "você já tem X do nível resultante" -- só quando o jogador já
// possui pelo menos 1 cópia do nível PRODUZIDO por esse merge (sala +
// inventário colado, via ownedByNameLevelMap). Reaproveitado tanto no card
// principal quanto em cada passo da Cadeia Completa.
function AlreadyOwnedWarning({
  requiredCopies,
  fromLevel,
  toLevel,
  ownedAtToLevel,
}: {
  requiredCopies: number
  fromLevel: number
  toLevel: number
  ownedAtToLevel: number
}) {
  if (ownedAtToLevel <= 0) return null
  return (
    <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-300">
      Este merge consome {requiredCopies}× {rarityLabel(fromLevel)} e produz 1 {rarityLabel(toLevel)}
      . Você já tem {ownedAtToLevel} {rarityLabel(toLevel)} -- ficará com {ownedAtToLevel + 1}.
    </div>
  )
}

// "Impacto Real na Sala" -- delta de poder simulado (baseline vs sala com o
// merge aplicado), reaproveitando o mesmo motor do Simulador
// (calculateRoomPower/sumUniqueMinerBonusPercent) via computeRoomMergeImpact.
// Fase 1: só o card principal (próximo merge); Cadeia Completa e Alcance
// Real ficam pra uma próxima rodada.
function RoomImpactLine({ impact }: { impact: RoomMergeImpact }) {
  if (!impact.calculable) {
    return (
      <p className="mt-2 text-[11px] text-slate-500">
        Impacto na sala: não calculável (peças fora da sala)
      </p>
    )
  }

  const sign = impact.deltaPower >= 0 ? '+' : ''
  const colorClass = impact.deltaPower >= 0 ? 'text-emerald-400' : 'text-red-400'

  return (
    <p className="mt-2 text-xs">
      <span className="text-slate-400">Impacto real: </span>
      <span className={colorClass}>
        {sign}
        {formatPower(impact.deltaPower)} ({sign}
        {impact.deltaPercent.toFixed(3)}% em relação ao poder permanente atual)
      </span>
    </p>
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
// laranja (exclui só o vermelho), "Ótimos" = só verde. Badge/filtro
// deliberadamente baseados no Ratio Poder isolado (não no Impacto Real
// binário) -- o Ratio Poder é sempre calculável, independente de o
// minerador estar fisicamente na sala hoje ou não.
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

// Filtra pelo "Alcance Real" já calculado (chainSimulations.reachedLevel) --
// mostra só mineradores que conseguem chegar em pelo menos essa raridade
// HOJE, só com cópias (mesma definição já usada na frase de Alcance Real,
// sem checar peça).
type ReachFilter = 'any' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'unreal'

const REACH_TABS: { key: ReachFilter; label: string; minLevel: number }[] = [
  { key: 'any', label: 'Qualquer', minLevel: 0 },
  { key: 'uncommon', label: 'Uncommon+', minLevel: 2 },
  { key: 'rare', label: 'Rare+', minLevel: 3 },
  { key: 'epic', label: 'Epic+', minLevel: 4 },
  { key: 'legendary', label: 'Legendary+', minLevel: 5 },
  { key: 'unreal', label: 'Unreal', minLevel: 6 },
]

type SortOption =
  | 'padrao'
  | 'custo-beneficio-isolado'
  | 'custo-beneficio-real'
  | 'poder_desc'
  | 'poder_asc'
  | 'bonus_desc'
  | 'bonus_asc'

const SORT_OPTIONS: SortDropdownOption<SortOption>[] = [
  { value: 'padrao', label: 'Nome (A-Z)' },
  { value: 'custo-beneficio-isolado', label: 'Custo-benefício (isolado)' },
  { value: 'custo-beneficio-real', label: 'Custo-benefício real' },
  { value: 'poder_desc', label: 'Poder ↓' },
  { value: 'poder_asc', label: 'Poder ↑' },
  { value: 'bonus_desc', label: 'Bônus ↓' },
  { value: 'bonus_asc', label: 'Bônus ↑' },
]

// Um passo da "Cadeia Completa" expandida -- mesmo estilo compacto dos
// cards principais, reaproveitando os campos já calculados por
// simulateMergeChain (cópias derivadas de merges anteriores, peças reais do
// inventário, ratio de qualidade).
function ChainStepRow({
  step,
  realOwnedAtFromLevel,
  ownedAtToLevel,
  roomImpact,
}: {
  step: ChainSimulation['steps'][number]
  realOwnedAtFromLevel: number
  ownedAtToLevel: number
  // null quando não há sala carregada; RoomMergeImpact (calculable true/
  // false) quando há -- ver comentário em FullChain sobre por que a
  // maioria dos passos além do primeiro fica não-calculável.
  roomImpact: RoomMergeImpact | null
}) {
  // "Cópias" mostra só posse REAL (sala + colado) nesse nível específico --
  // NUNCA a cascata simulada (step.availableCopies/missingCopies, usada só
  // pra calcular custo/taxa/alcance internamente, continuam como estão).
  // Mostrar o valor projetado aqui dava a impressão de que o jogador já
  // tinha cópias que na verdade só existiriam SE os merges anteriores da
  // cadeia já tivessem sido feitos.
  const realMissingCopies = Math.max(0, step.requiredCopies - realOwnedAtFromLevel)

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

      <PowerBonusLine
        fromPower={step.fromPower}
        toPower={step.power}
        fromBonus={step.fromBonus}
        toBonus={step.bonus}
      />

      {roomImpact && <RoomImpactLine impact={roomImpact} />}

      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-slate-400">Cópias</span>
        <span className={realMissingCopies > 0 ? 'text-red-400' : 'text-emerald-400'}>
          {realOwnedAtFromLevel} / {step.requiredCopies}
          {realMissingCopies > 0 && ` (faltam ${realMissingCopies})`}
        </span>
      </div>

      <AlreadyOwnedWarning
        requiredCopies={step.requiredCopies}
        fromLevel={step.fromLevel}
        toLevel={step.toLevel}
        ownedAtToLevel={ownedAtToLevel}
      />

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
  ownedByNameLevelMap,
  roomImpactContext,
}: {
  miner: Miner
  currentLevel: number
  simulation: ChainSimulation
  ownedByNameLevelMap: Map<string, number>
  roomImpactContext: RoomImpactContext | null
}) {
  if (simulation.steps.length === 0) return null

  const last = simulation.steps[simulation.steps.length - 1]
  const currentPower = getMinerPowerAtLevel(miner, currentLevel)
  const powerGained = last.power - currentPower

  // Impacto Real de CADA passo -- reaproveita computeRoomMergeImpact (mesma
  // função do card principal, sem duplicar). Só é calculável quando as
  // cópias do nível de ORIGEM daquele passo específico estão fisicamente na
  // sala hoje -- como o jogador normalmente só tem cópias reais nos
  // primeiros níveis da cadeia (os passos mais avançados dependem de
  // merges ainda não feitos), é esperado que a maioria dos passos além do
  // primeiro fique "não calculável". Isso é o comportamento correto (mesma
  // regra já estabelecida pra "Cópias" mostrar só posse real), não um bug.
  const stepImpacts = simulation.steps.map((step) => {
    if (!roomImpactContext) return null
    const stepMerge = miner.merges.find((mg) => mg.level === step.toLevel)
    if (!stepMerge) return null
    return computeRoomMergeImpact(
      miner.id,
      step.fromLevel,
      step.requiredCopies,
      stepMerge,
      roomImpactContext.roomMiners,
      roomImpactContext.resolvedRoomInstances,
      roomImpactContext.roomRacks,
      roomImpactContext.gamesPower,
      roomImpactContext.accountBonusPercent,
      roomImpactContext.maxPower,
    )
  })

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
        {simulation.steps.map((step, i) => (
          <ChainStepRow
            key={step.toLevel}
            step={step}
            realOwnedAtFromLevel={ownedByNameLevelMap.get(`${miner.name}::${step.fromLevel}`) ?? 0}
            ownedAtToLevel={ownedByNameLevelMap.get(`${miner.name}::${step.toLevel}`) ?? 0}
            roomImpact={stepImpacts[i]}
          />
        ))}
      </div>
    </div>
  )
}

// Agrupa tudo que computeRoomMergeImpact precisa além dos parâmetros
// específicos de cada merge -- evita repetir 6 props soltas em FullChain e
// no useMemo que monta isso em Merges().
interface RoomImpactContext {
  roomMiners: RoomMiner[]
  resolvedRoomInstances: ResolvedRoomMinerInstance[]
  roomRacks: Rack[]
  gamesPower: number
  accountBonusPercent: number
  maxPower: number
}

export default function Merges() {
  // Mesmo contexto global usado no Dashboard/Calculadora/Simulador -- já
  // busca profile+room-config pro nickname da sidebar, sem precisar de um
  // fetch/input próprio aqui.
  const { playerData, error: playerError } = usePlayer()

  const [minersData, setMinersData] = useState<MinersData | null>(null)
  const [craftingPrices, setCraftingPrices] = useState<CraftingPrices | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [minersPasteText, setMinersPasteText] = useState('')
  const [partsPasteText, setPartsPasteText] = useState('')
  const [analyzeMessage, setAnalyzeMessage] = useState<string | null>(null)

  // Inventário de mineradores e de peças NÃO persistem mais -- só em
  // estado React (memória da sessão atual); o jogador cola de novo a cada
  // visita. Nível da Forja e preço de peças continuam persistentes.
  const [minersInventory, setMinersInventory] = useState<MatchedMinerEntry[]>([])
  const [partsInventory, setPartsInventory] = useState<PartInventoryEntry[]>([])
  const [unrecognized, setUnrecognized] = useState<MinerInventoryEntry[]>([])
  const [realForgeLevel, setRealForgeLevel] = useState<number>(() => readRealForgeLevel())
  const [partPrices, setPartPrices] = useState<Record<string, number>>(() => readStoredPartPrices())
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ready')
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all')
  const [reachFilter, setReachFilter] = useState<ReachFilter>('any')
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

  // Limpeza única das chaves antigas de inventário (rc-miners-inventory/
  // rc-parts-inventory) -- não persistem mais, então não tem por que
  // deixar lixo de sessões anteriores acumulado.
  useEffect(() => {
    clearLegacyInventoryKeys()
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
    setPartsInventory(parsedParts)
    setUnrecognized(newUnrecognized)

    setAnalyzeMessage(
      `${matched.length} entradas de mineradores reconhecidas, ${parsedParts.length} tipos de peça, ` +
        `${newUnrecognized.length} não reconhecidas`,
    )
  }

  const forgeDiscount = FORGE_LEVELS[realForgeLevel - 1]?.discount ?? 0

  // Mineradores JÁ NA SALA (room-config) -- o inventário colado ("Meus
  // Mineradores") só cobre o Storage, fora da sala, então a contagem real de
  // cópias precisa somar os dois. room-config não indica o nível de merge
  // de cada instância de forma direta e confiável (campo `level` usa uma
  // numeração própria, sem correspondência fixa com miners.json -- 0 tanto
  // pra base quanto pra outros casos dependendo do tipo), então casa cada
  // minerador da sala pelo NOME+POWER reaproveitando matchMinersInventory
  // (mesma tolerância de 0.5%), convertendo pro mesmo formato do parser de
  // inventário colado.
  const roomInventoryEntries = useMemo<MinerInventoryEntry[]>(() => {
    const roomMiners = playerData?.roomConfig?.miners
    if (!roomMiners) return []
    return roomMiners
      .filter((m): m is typeof m & { name: string } => !!m.name)
      .map((m) => ({
        name: m.name,
        cells: 0,
        powerValue: m.power,
        bonusPercent: (m.bonus_percent ?? 0) / 100,
        quantity: 1,
        sellable: true,
      }))
  }, [playerData])

  const roomMatchResult = useMemo(() => {
    if (!minersData) return { matched: [], unrecognized: [] }
    return matchMinersInventory(roomInventoryEntries, minersData.miners)
  }, [roomInventoryEntries, minersData])

  // Total de cópias usado em TODOS os cálculos (cards, Cadeia Completa,
  // Alcance Real) = inventário colado + sala -- computeMergeNeeds já soma
  // quantidades pelo mesmo par nome+nível, então basta concatenar as duas
  // listas antes de passar pra ele (sem lógica de soma duplicada aqui).
  const combinedMinersInventory = useMemo(
    () => [...minersInventory, ...roomMatchResult.matched],
    [minersInventory, roomMatchResult],
  )

  // Cópias já possuídas por nome+nível (sala + colado) -- reaproveitado pro
  // aviso "você já tem X do nível resultante" (item 2), tanto no card
  // principal quanto em cada passo da Cadeia Completa.
  const ownedByNameLevelMap = useMemo(
    () => buildOwnedByNameLevelMap(combinedMinersInventory),
    [combinedMinersInventory],
  )

  const allUnrecognized = useMemo(
    () => [...unrecognized, ...roomMatchResult.unrecognized],
    [unrecognized, roomMatchResult],
  )

  const mergeNeeds = useMemo<MergeNeed[]>(() => {
    if (!minersData || !craftingPrices) return []
    return computeMergeNeeds(
      combinedMinersInventory,
      minersData.miners,
      partsInventory,
      forgeDiscount,
      partPrices,
      craftingPrices,
    )
  }, [combinedMinersInventory, minersData, partsInventory, forgeDiscount, partPrices, craftingPrices])

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      ready: 0,
      'parts-missing': 0,
      'copies-missing': 0,
    }
    for (const need of mergeNeeds) counts[need.status]++
    return counts
  }, [mergeNeeds])

  const minersById = useMemo(() => {
    const map = new Map<string, Miner>()
    if (minersData) for (const m of minersData.miners) map.set(m.id, m)
    return map
  }, [minersData])

  const partsOwnedMap = useMemo(() => buildPartsOwnedMap(partsInventory), [partsInventory])

  // Simulação de "até onde dá pra subir só com as cópias já possuídas" --
  // alimenta tanto a frase de "Alcance Real" quanto a lista detalhada da
  // "Cadeia Completa" quanto o filtro de "Alcance mínimo" (mesmos dados,
  // sem duplicar o cálculo).
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
          ownedByNameLevelMap,
          partsOwnedMap,
          forgeDiscount,
          partPrices,
          craftingPrices,
        ),
      )
    }
    return map
  }, [mergeNeeds, minersById, ownedByNameLevelMap, partsOwnedMap, forgeDiscount, partPrices, craftingPrices])

  // Cada instância FÍSICA da sala casada individualmente (não agregada em
  // quantidade) contra miners.json -- "Impacto Real na Sala" precisa saber
  // exatamente quais cópias remover (e o rack de cada uma) pra simular um
  // merge, o que a contagem agregada de ownedByNameLevelMap não dá.
  const resolvedRoomInstances = useMemo(() => {
    if (!minersData || !playerData?.roomConfig) return []
    return matchRoomMinerInstances(playerData.roomConfig.miners, minersData.miners)
  }, [playerData, minersData])

  // Agrupa tudo que computeRoomMergeImpact precisa da sala/conta além dos
  // parâmetros específicos de cada merge -- null quando não há sala
  // carregada (nickname não buscado ou falhou), reaproveitado tanto no
  // card principal quanto em cada passo da Cadeia Completa.
  const roomImpactContext = useMemo<RoomImpactContext | null>(() => {
    if (!playerData?.roomConfig) return null
    return {
      roomMiners: playerData.roomConfig.miners,
      resolvedRoomInstances,
      roomRacks: playerData.roomConfig.racks,
      gamesPower: playerData.games,
      accountBonusPercent: playerData.bonus_percent,
      maxPower: playerData.max_power,
    }
  }, [playerData, resolvedRoomInstances])

  // Impacto real (delta de poder simulado) do PRÓXIMO merge de cada
  // minerador -- alimenta o badge de qualidade, os filtros "Válidos" e a
  // ordenação "Custo-benefício real" no card principal. Reaproveita o
  // mesmo motor do Simulador via computeRoomMergeImpact.
  const roomMergeImpacts = useMemo(() => {
    const map = new Map<string, RoomMergeImpact>()
    if (!minersData || !roomImpactContext) return map
    for (const need of mergeNeeds) {
      const miner = minersById.get(need.minerId)
      const nextMerge = miner?.merges.find((mg) => mg.level === need.nextLevel)
      if (!nextMerge) continue
      map.set(
        need.minerId,
        computeRoomMergeImpact(
          need.minerId,
          need.currentLevel,
          need.requiredCopies,
          nextMerge,
          roomImpactContext.roomMiners,
          roomImpactContext.resolvedRoomInstances,
          roomImpactContext.roomRacks,
          roomImpactContext.gamesPower,
          roomImpactContext.accountBonusPercent,
          roomImpactContext.maxPower,
        ),
      )
    }
    return map
  }, [mergeNeeds, minersById, roomImpactContext, minersData])

  const filteredMergeNeeds = useMemo(() => {
    const filtered = mergeNeeds.filter((need) => {
      if (need.status !== statusFilter) return false
      if (!passesQualityFilter(need.nextRatioPower, qualityFilter)) return false
      const minReachLevel = REACH_TABS.find((tab) => tab.key === reachFilter)?.minLevel ?? 0
      if (minReachLevel > 0) {
        const reachedLevel = chainSimulations.get(need.minerId)?.reachedLevel ?? need.currentLevel
        if (reachedLevel < minReachLevel) return false
      }
      return true
    })
    // Poder/Bônus usam o valor do PRÓXIMO nível de merge disponível --
    // desempate de 2 níveis na mesma direção do sort ativo, mesmo padrão já
    // usado em /mineradores (getEffectivePower/getEffectiveBonus lá, aqui
    // nextPower/nextBonus porque o critério é por instância possuída, não
    // pelo nível mais forte absoluto do minerador).
    switch (sortOption) {
      case 'custo-beneficio-isolado':
        return [...filtered].sort((a, b) => a.nextRatioPower - b.nextRatioPower)
      case 'custo-beneficio-real': {
        // Impacto Real ÷ custo total do merge (peças + taxa) em RLT --
        // maior primeiro. Não-calculáveis (peças fora da sala, sem valor
        // real pra comparar) vão pro final, fora da ordenação por score.
        const scoreOf = (n: MergeNeed) => {
          const impact = roomMergeImpacts.get(n.minerId)
          if (!impact?.calculable) return null
          const cost = n.mergeFeeCost + n.totalMissingPartsCost
          if (cost <= 0) return impact.deltaPower > 0 ? Infinity : -Infinity
          return impact.deltaPower / cost
        }
        const calculable = filtered.filter((n) => scoreOf(n) !== null)
        const notCalculable = filtered.filter((n) => scoreOf(n) === null)
        return [...calculable.sort((a, b) => scoreOf(b)! - scoreOf(a)!), ...notCalculable]
      }
      case 'poder_desc':
        return [...filtered].sort((a, b) => b.nextPower - a.nextPower || b.nextBonus - a.nextBonus)
      case 'poder_asc':
        return [...filtered].sort((a, b) => a.nextPower - b.nextPower || a.nextBonus - b.nextBonus)
      case 'bonus_desc':
        return [...filtered].sort((a, b) => b.nextBonus - a.nextBonus || b.nextPower - a.nextPower)
      case 'bonus_asc':
        return [...filtered].sort((a, b) => a.nextBonus - b.nextBonus || a.nextPower - b.nextPower)
      default:
        return filtered
    }
  }, [mergeNeeds, statusFilter, qualityFilter, reachFilter, chainSimulations, sortOption, roomMergeImpacts])

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
            {playerData?.roomConfig ? (
              <p className="mt-1.5 text-[11px] text-slate-500">
                Cópias consideram sala ({playerData.roomConfig.miners.length} mineradores) +
                inventário colado.
              </p>
            ) : playerError ? (
              <p className="mt-1.5 text-[11px] text-amber-500">
                Não foi possível carregar a sala ({playerError}) -- usando só o inventário colado.
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-slate-500">
                Cópias consideram sala + inventário colado (busque seu nickname na barra
                lateral).
              </p>
            )}
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

          <PartPricesPasteCard onPricesSaved={setPartPrices} />
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
                  {sortOption === 'custo-beneficio-isolado' && (
                    <p className="text-[10px] text-slate-500">
                      Custo-benefício isolado (sem considerar bônus de sala)
                    </p>
                  )}
                  {sortOption === 'custo-beneficio-real' && (
                    <p className="text-[10px] text-slate-500">
                      Impacto real na sala ÷ custo do merge -- não calculáveis vão pro final
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500">Alcance mínimo (hoje, só cópias):</span>
                {REACH_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setReachFilter(tab.key)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      reachFilter === tab.key
                        ? 'bg-slate-600 text-white'
                        : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {tab.label}
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

                        <PowerBonusLine
                          fromPower={need.currentPower}
                          toPower={need.nextPower}
                          fromBonus={need.currentBonus}
                          toBonus={need.nextBonus}
                        />

                        {roomMergeImpacts.has(need.minerId) && (
                          <RoomImpactLine impact={roomMergeImpacts.get(need.minerId)!} />
                        )}

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

                        <AlreadyOwnedWarning
                          requiredCopies={need.requiredCopies}
                          fromLevel={need.currentLevel}
                          toLevel={need.nextLevel}
                          ownedAtToLevel={
                            ownedByNameLevelMap.get(`${need.minerName}::${need.nextLevel}`) ?? 0
                          }
                        />

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

                          // Todos os passos DENTRO do alcance real (do atual
                          // até reachedLevel) -- reaproveita as peças já
                          // calculadas por simulateMergeChain pra cada
                          // passo, sem duplicar o cálculo.
                          const stepsInReach = simulation.steps.filter(
                            (s) => s.toLevel <= simulation.reachedLevel,
                          )
                          const deficitLines = stepsInReach.flatMap((s) =>
                            s.partsNeeded
                              .filter((p) => p.missing > 0)
                              .map((p) => ({ step: s, part: p })),
                          )
                          const totalMissingCost = deficitLines.reduce(
                            (sum, { part }) => sum + part.missingCost,
                            0,
                          )

                          // Agregado de crafting -- reaproveita
                          // simulatePartCrafting já calculado por
                          // PartNeed.craftAlternative (não recalcula nada
                          // aqui), só soma por TIPO quanto de Common seria
                          // consumido no total (e o déficit residual de
                          // Common, se nem craftando dá pra fechar 100%).
                          const consumedCommonByType = new Map<PartType, number>()
                          const residualCommonByType = new Map<PartType, number>()
                          let totalCraftCost = 0
                          for (const { part } of deficitLines) {
                            const alt = part.craftAlternative
                            if (!alt) continue
                            totalCraftCost += alt.totalRLTCost
                            const commonUsed = alt.consumedByRarity.common ?? 0
                            if (commonUsed > 0) {
                              consumedCommonByType.set(
                                part.type,
                                (consumedCommonByType.get(part.type) ?? 0) + commonUsed,
                              )
                            }
                            if (!alt.fullyCraftable && alt.finalDeficit > 0) {
                              residualCommonByType.set(
                                part.type,
                                (residualCommonByType.get(part.type) ?? 0) + alt.finalDeficit,
                              )
                            }
                          }
                          const hasCraftOption = consumedCommonByType.size > 0

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
                              {deficitLines.length === 0 ? (
                                <p className="mt-1 text-emerald-400">Peças do passo final: completas.</p>
                              ) : (
                                <div className="mt-1.5">
                                  {hasCraftOption && (
                                    <p className="text-amber-400">
                                      Craftando do estoque: usa{' '}
                                      {[...consumedCommonByType].map(([type, qty], i, arr) => (
                                        <span key={type}>
                                          {qty} {partPriceKey('common', type)}
                                          {i < arr.length - 1 ? ', ' : ''}
                                        </span>
                                      ))}{' '}
                                      no total, custando {formatRLT(totalCraftCost)} RLT em fusões de
                                      peça
                                    </p>
                                  )}
                                  {residualCommonByType.size > 0 && (
                                    <p className="mt-1 text-red-400">
                                      Mesmo craftando, ainda faltariam{' '}
                                      {[...residualCommonByType].map(([type, qty], i, arr) => (
                                        <span key={type}>
                                          {qty} {partPriceKey('common', type)}
                                          {i < arr.length - 1 ? ', ' : ''}
                                        </span>
                                      ))}{' '}
                                      -- precisaria comprar ou farmar.
                                    </p>
                                  )}
                                  <p className="mt-1.5 space-y-0.5 font-semibold text-white">
                                    <span className="block">
                                      Total (taxas de merge + peças, comprando):{' '}
                                      {formatRLT(simulation.totalFeeCost + totalMissingCost)} RLT
                                    </span>
                                    {hasCraftOption && (
                                      <span className="block">
                                        Total (taxas de merge + peças, craftando):{' '}
                                        {formatRLT(simulation.totalFeeCost + totalCraftCost)} RLT
                                      </span>
                                    )}
                                  </p>
                                </div>
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
                                    ownedByNameLevelMap={ownedByNameLevelMap}
                                    roomImpactContext={roomImpactContext}
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

          {allUnrecognized.length > 0 && (
            <Card title={`Entradas não reconhecidas (${allUnrecognized.length})`}>
              <p className="mb-2 text-xs text-slate-400">
                Essas entradas (do inventário colado ou da sala) não bateram com nenhum
                minerador/nível conhecido. Confira se o texto colado está completo.
              </p>
              <ul className="max-h-64 space-y-1 overflow-y-auto text-xs text-slate-300">
                {unrecognized.map((entry, i) => (
                  <li key={`paste-${i}`}>
                    {entry.name} -- {formatPower(entry.powerValue)}, {entry.bonusPercent}% bônus,
                    x{entry.quantity} (inventário colado)
                  </li>
                ))}
                {roomMatchResult.unrecognized.map((entry, i) => (
                  <li key={`room-${i}`}>
                    {entry.name} -- {formatPower(entry.powerValue)}, x{entry.quantity} (sala)
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
