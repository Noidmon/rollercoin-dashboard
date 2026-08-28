import { useEffect, useMemo, useState } from 'react'
import SortDropdown, { type SortDropdownOption } from './SortDropdown'
import { formatPower } from '../utils/formatPower'
import type { MinersData } from '../types/miner'
import type { HypotheticalAddItem } from '../hooks/useHypotheticalInventory'

// Modal "+" do painel de Inventário Importado (Prompt 76) -- testar
// hipoteticamente o impacto de um MINERADOR que o jogador não possui,
// buscando no catálogo completo (miners.json, 1680 itens) em vez do que
// foi colado. Também mostra o catálogo de RACKS (racks.json, 72 itens)
// pra consulta de ficha técnica -- mas só MINERADORES podem ser
// efetivamente adicionados (ver limitação documentada no topo de
// Simulador.tsx: não existe hoje nenhum jeito de colocar uma rack NOVA
// num espaço vazio da sala, só trocar/preencher miners dentro de racks já
// existentes -- então uma rack hipotética não teria como ser "usada" na
// simulação ainda).
interface RackCatalogItem {
  rackId: string
  name: string
  image: string | null
  bonus: number
  cells: number
  width: number
  height: number
}

interface RacksJson {
  racks: RackCatalogItem[]
}

type CatalogMode = 'miners' | 'racks'
type SortOption = 'bonus_desc' | 'bonus_asc'

const SORT_OPTIONS: SortDropdownOption<SortOption>[] = [
  { value: 'bonus_desc', label: 'BÔNUS ▼' },
  { value: 'bonus_asc', label: 'BÔNUS ▲' },
]

const CARD_WIDTH_PX = 150

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

interface MinerCatalogCardProps {
  id: string
  name: string
  image: string | null
  cells: number
  bonus: number
  power: number | null
  selected: boolean
  quantity: number
  onSelect: () => void
  onQuantityChange: (qty: number) => void
}

// Card clicável do catálogo -- clicar revela o stepper (- N +) SOBRE a
// miniatura, começando em 1 (pedido explícito). `power` null pra racks
// (racks não têm poder próprio, só bônus% -- diferente de um minerador).
function CatalogCard({
  name,
  image,
  cells,
  bonus,
  power,
  selected,
  quantity,
  onSelect,
  onQuantityChange,
}: MinerCatalogCardProps) {
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-lg border transition-colors ${
        selected ? 'border-indigo-500 bg-indigo-950/30' : 'border-slate-700 bg-slate-800'
      }`}
      style={{ width: CARD_WIDTH_PX }}
    >
      <button
        type="button"
        onClick={onSelect}
        className="relative flex h-20 w-full items-center justify-center bg-slate-900 p-2"
      >
        {image ? (
          <img src={image} alt={name} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-slate-600">?</span>
        )}
        {selected && (
          <div
            className="absolute inset-0 flex items-center justify-center gap-1.5 bg-slate-950/90"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white hover:bg-slate-600"
            >
              −
            </button>
            <span className="w-6 text-center text-sm font-bold text-white">{quantity}</span>
            <button
              type="button"
              onClick={() => onQuantityChange(quantity + 1)}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white hover:bg-slate-600"
            >
              +
            </button>
          </div>
        )}
      </button>
      <p className="truncate px-2 pt-1.5 text-center text-xs font-semibold text-white" title={name}>
        {name}
      </p>
      <p className="px-2 pb-2 pt-0.5 text-center text-[11px] text-slate-400">
        {cells} {cells === 1 ? 'célula' : 'células'} | {bonus}%{power !== null ? ` | ${formatPower(power)}` : ''}
      </p>
    </div>
  )
}

export default function AddInventoryModal({
  onAdd,
  onClose,
}: {
  onAdd: (items: HypotheticalAddItem[]) => void
  onClose: () => void
}) {
  const [minersData, setMinersData] = useState<MinersData | null>(null)
  const [racksData, setRacksData] = useState<RacksJson | null>(null)
  const [mode, setMode] = useState<CatalogMode>('miners')
  const [searchText, setSearchText] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('bonus_desc')
  const [selected, setSelected] = useState<Map<string, number>>(new Map())

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
    fetch('/data/racks.json')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json() as Promise<RacksJson>
      })
      .then((json) => {
        if (!cancelled) setRacksData(json)
      })
      .catch(() => {
        if (!cancelled) setRacksData({ racks: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const minerItems = useMemo(() => {
    const search = searchText.trim().toLowerCase()
    const filtered = (minersData?.miners ?? []).filter((m) => !search || m.name.toLowerCase().includes(search))
    return [...filtered].sort((a, b) => (sortOption === 'bonus_desc' ? b.bonus - a.bonus : a.bonus - b.bonus))
  }, [minersData, searchText, sortOption])

  const rackItems = useMemo(() => {
    const search = searchText.trim().toLowerCase()
    const filtered = (racksData?.racks ?? []).filter((r) => !search || r.name.toLowerCase().includes(search))
    return [...filtered].sort((a, b) => (sortOption === 'bonus_desc' ? b.bonus - a.bonus : a.bonus - b.bonus))
  }, [racksData, searchText, sortOption])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, 1)
      return next
    })
  }

  function setQuantity(id: string, qty: number) {
    setSelected((prev) => new Map(prev).set(id, qty))
  }

  const selectedCount = selected.size

  function handleAdd() {
    if (mode !== 'miners') {
      onClose()
      return
    }
    const items: HypotheticalAddItem[] = []
    for (const miner of minerItems) {
      const qty = selected.get(miner.id)
      if (!qty || qty <= 0) continue
      items.push({
        catalogId: miner.id,
        name: miner.name,
        power: miner.power,
        bonus: miner.bonus,
        cells: miner.cells,
        image: miner.image,
        quantity: qty,
      })
    }
    onAdd(items)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">Adicionar Miner</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-700"
          >
            ✕
          </button>
        </div>

        {/* Prompt 78: mais respiro (p-3 -> px-4 py-4) -- ficava espremida
            contra a grade de cards logo abaixo, sem folga nenhuma.
            Prompt 80: overflow-x-auto removido -- era copiado do painel de
            Inventário Importado (que tem MUITO mais elementos na mesma
            linha: busca, sort, 2 toggles de largura, toggle racks/miners,
            setas de página, "+") sem necessidade real aqui -- esse modal só
            tem busca+sort+toggle Miner/Rack, cabe numa linha só na largura
            do modal (max-w-3xl) sem precisar rolar. flex-wrap no lugar de
            flex-nowrap como rede de segurança caso a viewport fique estreita
            o bastante pra não caber (nunca acontece na largura padrão do
            modal, mas evita clipping silencioso em vez de reintroduzir
            scroll). */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-4">
          <div className="relative min-w-[90px] flex-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar por nome..."
              className="w-full rounded-md border border-slate-700 bg-slate-900 py-1.5 pl-8 pr-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="shrink-0">
            <SortDropdown options={SORT_OPTIONS} value={sortOption} onChange={setSortOption} />
          </div>

          <div className="flex shrink-0 gap-1.5">
            {(['miners', 'racks'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                  mode === m ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {m === 'miners' ? 'Miner' : 'Rack'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'racks' && (
          <p className="border-b border-slate-800 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
            Racks são só pra consulta da ficha técnica -- ainda não é possível adicionar uma rack nova a um espaço
            vazio da sala na simulação, só trocar/preencher mineradores em racks que já existem.
          </p>
        )}

        {/* Prompt 79: scroll aqui é esperado (até 120 cards do catálogo,
            bem mais alto que o espaço disponível) -- não é bug de layout
            (confirmado: o container GERAL do modal, acima, não tem
            scroll nenhum, overflow-hidden dele sempre bate certo). Só
            estiliza a barra pra ficar fina/discreta, combinando com o
            tema escuro, em vez de remover o scroll (que é necessário). */}
        <div className="scrollbar-themed flex-1 overflow-y-auto p-4">
          <div className="flex flex-wrap gap-3">
            {mode === 'miners'
              ? minerItems.slice(0, 120).map((miner) => (
                  <CatalogCard
                    key={miner.id}
                    id={miner.id}
                    name={miner.name}
                    image={miner.image}
                    cells={miner.cells}
                    bonus={miner.bonus}
                    power={miner.power}
                    selected={selected.has(miner.id)}
                    quantity={selected.get(miner.id) ?? 1}
                    onSelect={() => toggleSelect(miner.id)}
                    onQuantityChange={(qty) => setQuantity(miner.id, qty)}
                  />
                ))
              : rackItems.slice(0, 120).map((rack) => (
                  <CatalogCard
                    key={rack.rackId}
                    id={rack.rackId}
                    name={rack.name}
                    image={rack.image}
                    cells={rack.cells}
                    bonus={rack.bonus}
                    power={null}
                    selected={false}
                    quantity={1}
                    onSelect={() => {}}
                    onQuantityChange={() => {}}
                  />
                ))}
          </div>
          {mode === 'miners' && minerItems.length > 120 && (
            <p className="mt-3 text-center text-xs text-slate-500">
              Mostrando os 120 primeiros de {minerItems.length} resultados -- refine a busca pra ver outros.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/40 px-4 py-3">
          <p className="text-xs text-slate-500">
            {mode === 'miners' ? `${selectedCount} selecionado${selectedCount === 1 ? '' : 's'}` : 'Consulta apenas'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={mode === 'miners' && selectedCount === 0}
              className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
