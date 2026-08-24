import { useEffect, useMemo, useState } from 'react'
import Card from './Card'
import SortDropdown, { type SortDropdownOption } from './SortDropdown'
import { formatPower } from '../utils/formatPower'
import { parseMinersInventory } from '../utils/parseMinersInventory'
import { buildMinersByNormalizedNameMap, resolveMinerLevel } from '../utils/matchMinersInventory'
import {
  getMergeLevelColor,
  getMinerBonusAtLevel,
  getMinerLevelRarityName,
  getMinerPowerAtLevel,
} from '../utils/minerMergeCalculator'
import type { MinersData, Miner } from '../types/miner'

// Painel do inventário de mineradores IMPORTADO (colado pelo jogador) --
// mesma filosofia de /merges (dado do usuário, nunca busca de catálogo
// público pra esse fim). Reaproveita parseMinersInventory +
// buildMinersByNormalizedNameMap/resolveMinerLevel (as mesmas peças já
// usadas por matchMinersInventory.ts, exportadas justamente pra permitir
// reaproveitamento sem duplicar a lógica de parsing/casamento) em vez de
// matchMinersInventory diretamente -- essa função agrega em quantidade e
// descarta a referência ao Miner do catálogo, mas aqui precisamos dela pra
// mostrar poder/bônus/células/imagem de cada entrada.

interface EnrichedEntry {
  key: string
  name: string
  power: number
  bonus: number
  cells: number
  image: string | null
  quantity: number
  matchedLevel: number
}

type SortOption = 'poder_desc' | 'poder_asc' | 'bonus_desc' | 'bonus_asc'

const SORT_OPTIONS: SortDropdownOption<SortOption>[] = [
  { value: 'poder_desc', label: 'PODER: MAIOR – MENOR' },
  { value: 'poder_asc', label: 'PODER: MENOR – MAIOR' },
  { value: 'bonus_desc', label: 'BÔNUS: MAIOR – MENOR' },
  { value: 'bonus_asc', label: 'BÔNUS: MENOR – MAIOR' },
]

const PAGE_SIZE = 8

function MinerCard({ entry }: { entry: EnrichedEntry }) {
  const color = getMergeLevelColor(entry.matchedLevel)
  return (
    <div className="relative rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <button
        type="button"
        disabled
        title="Adicionar à sala simulada (em breve)"
        className="absolute right-2 top-2 flex h-6 w-6 cursor-not-allowed items-center justify-center rounded-full bg-indigo-600/40 text-sm font-bold text-white/70"
      >
        +
      </button>

      <div className="flex items-center gap-3">
        {entry.image ? (
          <img src={entry.image} alt={entry.name} className="h-12 w-12 shrink-0 object-contain" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center text-slate-600">?</div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white" title={entry.name}>
            {entry.name}
          </p>
          <p className="text-[11px] font-bold" style={{ color }}>
            {getMinerLevelRarityName(entry.matchedLevel)}
          </p>
        </div>
      </div>

      <div className="mt-2 space-y-0.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Poder</span>
          <span className="text-slate-200">{formatPower(entry.power)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Bônus</span>
          <span className="text-slate-200">{entry.bonus}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Quantidade</span>
          <span className="text-slate-200">x{entry.quantity}</span>
        </div>
      </div>
    </div>
  )
}

export default function RoomInventoryPanel() {
  const [minersData, setMinersData] = useState<MinersData | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [entries, setEntries] = useState<EnrichedEntry[]>([])
  const [unrecognizedCount, setUnrecognizedCount] = useState<number | null>(null)

  const [searchText, setSearchText] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('poder_desc')
  const [widthFilter, setWidthFilter] = useState<Set<number>>(() => new Set([1, 2]))
  const [activeTab, setActiveTab] = useState<'racks' | 'miners'>('miners')
  const [page, setPage] = useState(0)

  // Catálogo estático (public/data/miners.json) -- só resolve imagem/poder/
  // bônus/células de cada minerador citado no texto colado, não é dado do
  // jogador (mesma exceção já documentada em RoomRacksLayer.tsx).
  useEffect(() => {
    let cancelled = false
    fetch('/data/miners.json')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json() as Promise<MinersData>
      })
      .then((json) => {
        if (!cancelled) setMinersData(json)
      })
      .catch(() => {
        if (!cancelled) setMinersData({ generatedAt: '', total: 0, totalMerges: 0, miners: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleImport() {
    if (!minersData) return

    const parsed = parseMinersInventory(pasteText)
    const minersByNormalizedName = buildMinersByNormalizedNameMap(minersData.miners)

    const next: EnrichedEntry[] = []
    let unrecognized = 0

    parsed.forEach((entry, index) => {
      const resolved = resolveMinerLevel(entry.name, entry.powerValue, minersByNormalizedName)
      if (!resolved) {
        unrecognized++
        return
      }
      const miner: Miner = resolved.miner
      next.push({
        key: `${miner.id}-${resolved.matchedLevel}-${index}`,
        name: miner.name,
        power: getMinerPowerAtLevel(miner, resolved.matchedLevel),
        bonus: getMinerBonusAtLevel(miner, resolved.matchedLevel),
        cells: miner.cells,
        image: miner.image,
        quantity: entry.quantity,
        matchedLevel: resolved.matchedLevel,
      })
    })

    setEntries(next)
    setUnrecognizedCount(unrecognized)
    setPage(0)
  }

  function toggleWidth(width: number) {
    setWidthFilter((prev) => {
      const next = new Set(prev)
      if (next.has(width)) next.delete(width)
      else next.add(width)
      return next
    })
    setPage(0)
  }

  const filteredSorted = useMemo(() => {
    const searchLower = searchText.trim().toLowerCase()
    const filtered = entries.filter((e) => {
      if (searchLower && !e.name.toLowerCase().includes(searchLower)) return false
      if (!widthFilter.has(e.cells)) return false
      return true
    })
    switch (sortOption) {
      case 'poder_desc':
        return [...filtered].sort((a, b) => b.power - a.power)
      case 'poder_asc':
        return [...filtered].sort((a, b) => a.power - b.power)
      case 'bonus_desc':
        return [...filtered].sort((a, b) => b.bonus - a.bonus)
      case 'bonus_asc':
        return [...filtered].sort((a, b) => a.bonus - b.bonus)
      default:
        return filtered
    }
  }, [entries, searchText, widthFilter, sortOption])

  const pageCount = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE))
  const clampedPage = Math.min(page, pageCount - 1)
  const pageEntries = filteredSorted.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE)

  return (
    <Card title="Inventário Importado" className="mt-4">
      <div>
        <label className="mb-1 block text-xs text-slate-400">
          Colar inventário de mineradores (mesmo texto usado em Merges)
        </label>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Cole aqui o texto copiado de 'Meus Mineradores'"
          rows={6}
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={handleImport}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Importar Inventário
          </button>
          {unrecognizedCount !== null && (
            <p className="text-xs text-slate-400">
              {entries.length} reconhecidos, {unrecognizedCount} não reconhecidos
            </p>
          )}
        </div>
      </div>

      {entries.length > 0 && (
        <div className="mt-5 space-y-3 border-t border-slate-800 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value)
                setPage(0)
              }}
              placeholder="Buscar por nome"
              className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <SortDropdown
              options={SORT_OPTIONS}
              value={sortOption}
              onChange={(v) => {
                setSortOption(v)
                setPage(0)
              }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1.5">
              {[1, 2].map((width) => (
                <button
                  key={width}
                  type="button"
                  onClick={() => toggleWidth(width)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    widthFilter.has(width)
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {width} {width === 1 ? 'Célula' : 'Células'}
                </button>
              ))}
            </div>

            <div className="flex gap-1.5">
              {(['racks', 'miners'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  title={tab === 'racks' ? 'Ainda não implementado' : undefined}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                    activeTab === tab
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {tab === 'racks' ? 'Racks' : 'Miners'}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'racks' ? (
            <p className="rounded-md border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-500">
              Aba Racks ainda não implementada.
            </p>
          ) : pageEntries.length === 0 ? (
            <p className="rounded-md border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-500">
              Nenhum minerador encontrado com esses filtros.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {pageEntries.map((entry) => (
                  <MinerCard key={entry.key} entry={entry} />
                ))}
              </div>

              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={clampedPage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ←
                </button>
                <span className="text-xs text-slate-400">
                  Página {clampedPage + 1} de {pageCount}
                </span>
                <button
                  type="button"
                  disabled={clampedPage >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  )
}
