import { useCallback, useMemo, useRef, useState } from 'react'
import Card from './Card'
import SortDropdown, { type SortDropdownOption } from './SortDropdown'
import AddInventoryModal from './AddInventoryModal'
import MinerBadges from './MinerBadges'
import { formatPower } from '../utils/formatPower'
import { isNameInAnySet, type MinerSetsData } from '../utils/minerSets'
import type { EnrichedMinerEntry } from '../hooks/useMinersInventoryImport'
import type { HypotheticalAddItem } from '../hooks/useHypotheticalInventory'

// MIME custom (Prompt 73, drag-and-drop) -- carrega só a KEY da entrada
// arrastada (RoomRacksLayer resolve a entry completa via essa key contra o
// array `inventory` que já tem em mãos). dataTransfer.getData só é
// confiável no evento `drop` em todo navegador (dragover não expõe o
// VALOR por segurança, só os tipos) -- por isso o feedback visual durante
// o arraste (quais células destacam verde) usa o estado React
// `draggedEntry` elevado a SimuladorContent, não dataTransfer.
export const DRAG_ENTRY_KEY_MIME = 'application/x-rlc-inventory-entry-key'

// Painel de RESULTADOS do inventário importado (colado pelo jogador) --
// mesma filosofia de /merges (dado do usuário, nunca busca de catálogo
// público pra esse fim). O campo de colar em si fica no painel de stats
// (InventoryPasteField, dentro de RoomStatsPanel) -- Prompt 58 moveu a UI
// de colar pra lá, deixando esse componente só com busca/ordenação/filtro/
// paginação/grid, alimentado via prop `entries` (mesmo estado, elevado a
// Simulador() via useMinersInventoryImport).

type SortOption = 'poder_desc' | 'poder_asc' | 'bonus_desc' | 'bonus_asc'

const SORT_OPTIONS: SortDropdownOption<SortOption>[] = [
  { value: 'poder_desc', label: 'PODER: MAIOR – MENOR' },
  { value: 'poder_asc', label: 'PODER: MENOR – MAIOR' },
  { value: 'bonus_desc', label: 'BÔNUS: MAIOR – MENOR' },
  { value: 'bonus_asc', label: 'BÔNUS: MENOR – MAIOR' },
]

// Referência (minaryganar) mostra UMA fileira de cards só, com as setas
// trocando a fileira inteira -- não uma grade 2D. Card width fixo (px) +
// gap usados tanto no CSS (inline, mesmo valor) quanto no cálculo de
// quantos cabem por fileira via ResizeObserver, então os dois nunca
// dessincronizam.
const CARD_WIDTH_PX = 150
const CARD_GAP_PX = 12

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

// draggable/onDragStart/onDragEnd são opcionais -- só vêm preenchidos
// quando o painel está ligado ao Simulador com uma sala simulada por trás
// (sempre, hoje) -- reaproveita EXATAMENTE a mesma operação de trocar uma
// célula vazia já usada pelo modal (swapMiner em useAutoOptimizer.ts), só
// disparada por drag em vez de clique (Prompt 73). `remaining` (se
// fornecido) mostra "restam N" igual ao seletor de troca do modal, e
// desabilita o arraste quando não sobra nenhuma cópia -- mesma regra de
// disponibilidade, uma fonte só (computeRemainingInventory).
function MinerCard({
  entry,
  remaining,
  isDragged,
  setsData,
  onDragStartEntry,
  onDragEndEntry,
}: {
  entry: EnrichedMinerEntry
  remaining?: number
  isDragged?: boolean
  setsData: MinerSetsData | null
  onDragStartEntry?: (entry: EnrichedMinerEntry) => void
  onDragEndEntry?: () => void
}) {
  const draggable = remaining === undefined || remaining > 0
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return
        e.dataTransfer.setData(DRAG_ENTRY_KEY_MIME, entry.key)
        e.dataTransfer.effectAllowed = 'copy'
        onDragStartEntry?.(entry)
      }}
      onDragEnd={() => onDragEndEntry?.()}
      className={`shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-800 transition-opacity ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-50'
      } ${isDragged ? 'opacity-40' : ''}`}
      style={{ width: CARD_WIDTH_PX }}
    >
      <div className="relative flex h-20 items-center justify-center bg-slate-900 p-2">
        <MinerBadges level={entry.matchedLevel} isInSet={setsData ? isNameInAnySet(entry.name, setsData) : false} />
        {entry.isHypothetical && (
          <span className="absolute right-1 top-1 rounded bg-amber-500 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-950">
            Teste
          </span>
        )}
        {entry.image ? (
          <img src={entry.image} alt={entry.name} className="max-h-full max-w-full object-contain pointer-events-none" />
        ) : (
          <span className="text-slate-600">?</span>
        )}
      </div>
      <p className="truncate px-2 pt-1.5 text-center text-xs font-semibold text-white" title={entry.name}>
        {entry.name}
      </p>
      <p className="px-2 pb-0.5 pt-0.5 text-center text-[11px] text-slate-400">
        {formatPower(entry.power)} | {entry.bonus}%
      </p>
      {remaining !== undefined && (
        <p className="px-2 pb-2 text-center text-[10px] text-slate-500">restam {remaining}</p>
      )}
    </div>
  )
}

export default function RoomInventoryPanel({
  entries,
  remainingByEntryKey,
  draggedEntryKey,
  setsData,
  onDragStartEntry,
  onDragEndEntry,
  onAddHypothetical,
}: {
  entries: EnrichedMinerEntry[]
  remainingByEntryKey?: Map<string, number>
  draggedEntryKey?: string | null
  // Catálogo de sets (Prompt 81) -- usado pro selo de set nos cards (aqui
  // e no modal "+", repassado pra lá em vez de duplicar o fetch).
  setsData: MinerSetsData | null
  onDragStartEntry?: (entry: EnrichedMinerEntry) => void
  onDragEndEntry?: () => void
  // Callback do modal "+" (Prompt 76) -- opcional só por simetria com o
  // resto das props de callback aqui; sempre fornecido pelo Simulador.
  onAddHypothetical?: (items: HypotheticalAddItem[]) => void
}) {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('poder_desc')
  const [widthFilter, setWidthFilter] = useState<Set<number>>(() => new Set([1, 2]))
  const [activeTab, setActiveTab] = useState<'racks' | 'miners'>('miners')
  const [page, setPage] = useState(0)

  // Quantos cards cabem numa fileira só, medido de verdade via
  // ResizeObserver (não um número fixo arbitrário) -- refaz o cálculo
  // sempre que a largura disponível mudar (resize da janela, sidebar
  // colapsada, etc). Fallback de 4 antes da primeira medição (evita
  // "pular" de 1 pra N na primeira renderização).
  //
  // Ref CALLBACK (não useRef+useEffect) de propósito: esse componente
  // retorna null inteiro até o primeiro import (entries.length === 0), e a
  // fileira some/reaparece condicionalmente depois disso (aba Racks,
  // filtro zerando os resultados). Um useEffect de deps [] só roda uma vez
  // por instância -- se essa única execução cair num momento em que o nó
  // ainda não existe (ex: antes do 1o import), o observer nunca é criado,
  // mesmo quando a fileira aparece depois. Ref callback dispara toda vez
  // que o nó do DOM muda de fato (monta/desmonta), então sempre reconecta.
  const observerRef = useRef<ResizeObserver | null>(null)
  const [perRow, setPerRow] = useState(4)

  const setRowRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) return
    const observer = new ResizeObserver((observerEntries) => {
      const width = observerEntries[0]?.contentRect.width ?? 0
      const fit = Math.floor((width + CARD_GAP_PX) / (CARD_WIDTH_PX + CARD_GAP_PX))
      setPerRow(Math.max(1, fit))
    })
    observer.observe(node)
    observerRef.current = observer
  }, [])

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

  const pageCount = Math.max(1, Math.ceil(filteredSorted.length / perRow))
  const clampedPage = Math.min(page, pageCount - 1)
  const pageEntries = filteredSorted.slice(clampedPage * perRow, clampedPage * perRow + perRow)

  // Prompt 76: painel agora sempre visível (antes escondia tudo, inclusive
  // o botão "+", enquanto nada tivesse sido colado) -- testar um item
  // hipotético não deveria depender de já ter colado inventário real
  // primeiro. Estado vazio já tratado mais abaixo ("Nenhum minerador
  // encontrado com esses filtros").

  return (
    <Card title="Inventário Importado" className="mt-4">
      {/* Barra de navegação numa linha só, SEMPRE (Prompt 59) -- flex-nowrap
          força uma linha até em notebooks (1366px); se não couber mesmo com
          a busca encolhendo ao mínimo, cai pra scroll horizontal
          (overflow-x-auto) em vez de quebrar. Só a busca encolhe
          (flex-1 + min-w baixo); o resto mantém largura fixa (shrink-0). */}
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border border-slate-700 bg-slate-800/60 p-2">
        <div className="relative min-w-[90px] flex-1">
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

        <div className="shrink-0">
          <SortDropdown
            options={SORT_OPTIONS}
            value={sortOption}
            onChange={(v) => {
              setSortOption(v)
              setPage(0)
            }}
          />
        </div>

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

        {/* Abre o modal de adicionar item hipotético (Prompt 76) -- busca
            no catálogo completo (miners.json/racks.json), independente do
            que o jogador possui de verdade. Placeholder desde o Prompt 59,
            implementado agora. */}
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          title="Adicionar minerador ou consultar rack pra testar hipoteticamente"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-500"
        >
          +
        </button>
      </div>

      {/* rowRef sempre montado (mesmo nos estados vazio/placeholder) --
          o ResizeObserver precisa de um nó estável pra não ficar "órfão"
          quando a fileira de cards entra/sai condicionalmente (troca de
          aba, filtro zerando os resultados). */}
      <div ref={setRowRef} className="mt-4">
        {activeTab === 'racks' ? (
          <p className="rounded-md border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-500">
            Aba Racks ainda não implementada.
          </p>
        ) : pageEntries.length === 0 ? (
          <p className="rounded-md border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-500">
            Nenhum minerador encontrado com esses filtros.
          </p>
        ) : (
          <div className="flex flex-nowrap gap-3 overflow-x-auto">
            {pageEntries.map((entry) => (
              <MinerCard
                key={entry.key}
                entry={entry}
                remaining={remainingByEntryKey?.get(entry.key)}
                isDragged={draggedEntryKey === entry.key}
                setsData={setsData}
                onDragStartEntry={onDragStartEntry}
                onDragEndEntry={onDragEndEntry}
              />
            ))}
          </div>
        )}
      </div>

      {addModalOpen && (
        <AddInventoryModal
          setsData={setsData}
          onAdd={(items) => onAddHypothetical?.(items)}
          onClose={() => setAddModalOpen(false)}
        />
      )}
    </Card>
  )
}
