import { useMemo, useState } from 'react'
import Card from './Card'
import SortDropdown, { type SortDropdownOption } from './SortDropdown'
import { formatPower } from '../utils/formatPower'
import { getMergeLevelColor } from '../utils/minerMergeCalculator'
import { resolveAssetUrl } from '../utils/resolveAssetUrl'
import type { EnrichedMinerEntry } from '../hooks/useMinersInventoryImport'

// Painel de RESULTADOS do inventário importado (colado pelo jogador) --
// mesma filosofia de /merges (dado do usuário, nunca busca de catálogo
// público pra esse fim). O campo de colar em si fica no painel de stats
// (InventoryPasteField, dentro de RoomStatsPanel) -- Prompt 58 moveu a UI
// de colar pra lá, deixando esse componente só com busca/ordenação/filtro/
// paginação/grid, alimentado via prop `entries` (mesmo estado, elevado a
// Simulador() via useMinersInventoryImport).

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
function toRoman(n: number): string {
  return ROMAN[n] ?? String(n)
}

type SortOption = 'poder_desc' | 'poder_asc' | 'bonus_desc' | 'bonus_asc'

const SORT_OPTIONS: SortDropdownOption<SortOption>[] = [
  { value: 'poder_desc', label: 'PODER: MAIOR – MENOR' },
  { value: 'poder_asc', label: 'PODER: MENOR – MAIOR' },
  { value: 'bonus_desc', label: 'BÔNUS: MAIOR – MENOR' },
  { value: 'bonus_asc', label: 'BÔNUS: MENOR – MAIOR' },
]

const PAGE_SIZE = 12

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-500">
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 1 0 3.35 9.86l3.65 3.64a.75.75 0 1 0 1.06-1.06l-3.64-3.65A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

// Selo de nível/raridade -- mesmo asset (rollercoin/levels/level_N.webp) e
// mesmo fallback (bloco colorido com numeral romano) já usados em
// MineradorDetalhe.tsx (LevelBadge). Level 0 (base, ainda não fundido) não
// tem selo -- mesma regra confirmada em minerLevelBadges (Prompt 57).
function RarityBadge({ level }: { level: number }) {
  const [imgFailed, setImgFailed] = useState(false)
  if (level <= 0) return null

  if (imgFailed) {
    return (
      <span
        className="absolute left-1 top-1 flex h-4 w-5 items-center justify-center rounded text-[9px] font-bold text-white"
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
      className="absolute left-1 top-1 h-4 w-5 object-contain"
    />
  )
}

function MinerCard({ entry }: { entry: EnrichedMinerEntry }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
      <div className="relative flex h-20 items-center justify-center bg-slate-900 p-2">
        <RarityBadge level={entry.matchedLevel} />
        {entry.image ? (
          <img src={entry.image} alt={entry.name} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-slate-600">?</span>
        )}
      </div>
      <p className="truncate px-2 pt-1.5 text-center text-xs font-semibold text-white" title={entry.name}>
        {entry.name}
      </p>
      <p className="px-2 pb-2 pt-0.5 text-center text-[11px] text-slate-400">
        {formatPower(entry.power)} | {entry.bonus}%
      </p>
    </div>
  )
}

export default function RoomInventoryPanel({ entries }: { entries: EnrichedMinerEntry[] }) {
  const [searchText, setSearchText] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('poder_desc')
  const [widthFilter, setWidthFilter] = useState<Set<number>>(() => new Set([1, 2]))
  const [activeTab, setActiveTab] = useState<'racks' | 'miners'>('miners')
  const [page, setPage] = useState(0)

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

  if (entries.length === 0) return null

  return (
    <Card title="Inventário Importado" className="mt-4">
      {/* Barra de navegação numa linha só (Prompt 58, correção 2) --
          flex-wrap só entra em telas estreitas, alvo é uma linha em
          desktop. */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-2">
        <div className="relative min-w-[140px] flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value)
              setPage(0)
            }}
            placeholder="Buscar por nome..."
            className="w-full rounded-md border border-slate-700 bg-slate-900 py-1.5 pl-8 pr-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <SortDropdown
          options={SORT_OPTIONS}
          value={sortOption}
          onChange={(v) => {
            setSortOption(v)
            setPage(0)
          }}
        />

        <div className="flex shrink-0 gap-1.5">
          {[1, 2].map((width) => (
            <button
              key={width}
              type="button"
              onClick={() => toggleWidth(width)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                widthFilter.has(width)
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-900 text-slate-500 hover:bg-slate-700/60'
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  widthFilter.has(width) ? 'bg-indigo-400' : 'bg-slate-600'
                }`}
              />
              {width} {width === 1 ? 'Célula' : 'Células'}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 gap-1.5">
          {(['racks', 'miners'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              title={tab === 'racks' ? 'Ainda não implementado' : undefined}
              className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {tab === 'racks' ? 'Racks' : 'Miners'}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={clampedPage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            title={`Página ${clampedPage + 1} de ${pageCount}`}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ←
          </button>
          <button
            type="button"
            disabled={clampedPage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            title={`Página ${clampedPage + 1} de ${pageCount}`}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-4">
        {activeTab === 'racks' ? (
          <p className="rounded-md border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-500">
            Aba Racks ainda não implementada.
          </p>
        ) : pageEntries.length === 0 ? (
          <p className="rounded-md border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-500">
            Nenhum minerador encontrado com esses filtros.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {pageEntries.map((entry) => (
              <MinerCard key={entry.key} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
