import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import SortDropdown, { type SortDropdownOption } from '../components/SortDropdown'
import { getEffectiveBonus, getEffectivePower } from '../utils/minerPower'
import MinerStatusIcons from '../components/MinerStatusIcons'
import type { MinersData } from '../types/miner'

const PAGE_SIZE = 24

type SortOption = 'recentes' | 'antigos' | 'poder_desc' | 'poder_asc' | 'bonus_desc' | 'bonus_asc'

const SORT_OPTIONS: SortDropdownOption<SortOption>[] = [
  { value: 'recentes', label: 'RECENTES' },
  { value: 'antigos', label: 'ANTIGOS' },
  { value: 'poder_desc', label: 'PODER ↓' },
  { value: 'poder_asc', label: 'PODER ↑' },
  { value: 'bonus_desc', label: 'BÔNUS ↓' },
  { value: 'bonus_asc', label: 'BÔNUS ↑' },
]

export default function Mineradores() {
  const [data, setData] = useState<MinersData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('recentes')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false

    fetch('/data/miners.json')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json()
      })
      .then((json: MinersData) => {
        if (!cancelled) setData(json)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
    }
  }, [])

  const filteredMiners = useMemo(() => {
    if (!data) return []
    const term = search.trim().toLowerCase()
    if (!term) return data.miners
    return data.miners.filter((m) => m.name.toLowerCase().includes(term))
  }, [data, search])

  // Contadores refletem o filtro ativo -- somam só os resultados filtrados,
  // não o total fixo do miners.json.
  const filteredMergesCount = useMemo(
    () => filteredMiners.reduce((sum, m) => sum + m.merges.length, 0),
    [filteredMiners],
  )

  // Não temos data de lançamento no miners.json (a API pública não expõe
  // isso na lista) -- RECENTES/ANTIGOS usam a ordem original do array (e o
  // reverse dela) como proxy de "mais novo primeiro". Não é um critério
  // real de data, só a ordem em que a API retornou os itens.
  const sortedMiners = useMemo(() => {
    switch (sortOption) {
      case 'antigos':
        return [...filteredMiners].reverse()
      case 'poder_desc':
        // empate no poder desempata pelo bônus, na mesma direção (desc)
        return [...filteredMiners].sort(
          (a, b) =>
            Number(getEffectivePower(b)) - Number(getEffectivePower(a)) ||
            Number(getEffectiveBonus(b)) - Number(getEffectiveBonus(a)),
        )
      case 'poder_asc':
        return [...filteredMiners].sort(
          (a, b) =>
            Number(getEffectivePower(a)) - Number(getEffectivePower(b)) ||
            Number(getEffectiveBonus(a)) - Number(getEffectiveBonus(b)),
        )
      case 'bonus_desc':
        // empate no bônus desempata pelo poder, na mesma direção (desc)
        return [...filteredMiners].sort(
          (a, b) =>
            Number(getEffectiveBonus(b)) - Number(getEffectiveBonus(a)) ||
            Number(getEffectivePower(b)) - Number(getEffectivePower(a)),
        )
      case 'bonus_asc':
        return [...filteredMiners].sort(
          (a, b) =>
            Number(getEffectiveBonus(a)) - Number(getEffectiveBonus(b)) ||
            Number(getEffectivePower(a)) - Number(getEffectivePower(b)),
        )
      case 'recentes':
      default:
        return filteredMiners
    }
  }, [filteredMiners, sortOption])

  const totalPages = Math.max(1, Math.ceil(sortedMiners.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageMiners = sortedMiners.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleSortChange(value: SortOption) {
    setSortOption(value)
    setPage(1)
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Mineradores</h1>
        <p className="mt-4 text-sm text-red-400">
          Erro ao carregar mineradores: {error}
        </p>
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Mineradores</h1>
        <p className="mt-4 text-sm text-slate-400">Carregando...</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Mineradores</h1>

      <div className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center justify-center gap-4">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Buscar mineradores..."
          className="w-full min-w-[240px] flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-auto"
        />

        <div className="flex gap-3">
          <div className="rounded-md border border-slate-500 bg-slate-900 px-4 py-2 text-center">
            <div className="text-xs uppercase tracking-wide text-slate-400">Mineradores</div>
            <div className="text-lg font-semibold text-white">
              {filteredMiners.length.toLocaleString('en-US')}
            </div>
          </div>
          <div className="rounded-md border border-slate-500 bg-slate-900 px-4 py-2 text-center">
            <div className="text-xs uppercase tracking-wide text-slate-400">Merges</div>
            <div className="text-lg font-semibold text-white">
              {filteredMergesCount.toLocaleString('en-US')}
            </div>
          </div>
        </div>

        <SortDropdown options={SORT_OPTIONS} value={sortOption} onChange={handleSortChange} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {pageMiners.map((miner) => (
          <Link
            key={miner.id}
            to={`/mineradores/${miner.slug}`}
            className="group relative overflow-hidden rounded-lg border border-slate-500 bg-slate-900 transition-colors hover:border-indigo-500"
          >
            <div className="absolute left-2 top-2 z-10 flex gap-1">
              <MinerStatusIcons sellable={miner.sellable} mergeable={miner.mergeable} />
            </div>

            <div className="flex h-32 items-center justify-center bg-slate-800 p-2">
              {miner.image ? (
                <img
                  src={miner.image}
                  alt={miner.name}
                  loading="lazy"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-slate-600">?</span>
              )}
            </div>

            <div className="bg-red-700 px-2 py-1.5 text-center text-xs font-semibold uppercase text-white transition-colors group-hover:bg-red-600">
              {miner.name}
            </div>
          </Link>
        ))}
      </div>

      {filteredMiners.length === 0 && (
        <p className="mt-6 text-sm text-slate-400">Nenhum minerador encontrado.</p>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-slate-400">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}
