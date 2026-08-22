import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

interface Miner {
  id: string
  name: string
  slug: string
  sellable: boolean
  mergeable: boolean
  power: number
  bonus: number
  cells: number
  image: string | null
  marketplaceUrl: string
  merges: unknown[]
}

interface MinersData {
  generatedAt: string
  total: number
  totalMerges: number
  miners: Miner[]
}

const PAGE_SIZE = 24

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      title={label}
      className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${
        ok ? 'bg-emerald-500/90' : 'bg-red-500/90'
      }`}
    >
      {ok ? '✓' : '✕'}
    </span>
  )
}

export default function Mineradores() {
  const [data, setData] = useState<MinersData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [recentFirst, setRecentFirst] = useState(false)
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

  // Não temos data de lançamento no miners.json (a API pública não expõe
  // isso na lista) -- usamos a ordem original do array como proxy de "mais
  // recente primeiro" via reverse(). Não é um critério real de data, só a
  // ordem em que a API retornou os itens.
  const orderedMiners = useMemo(() => {
    if (!data) return []
    return recentFirst ? [...data.miners].reverse() : data.miners
  }, [data, recentFirst])

  const filteredMiners = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return orderedMiners
    return orderedMiners.filter((m) => m.name.toLowerCase().includes(term))
  }, [orderedMiners, search])

  const totalPages = Math.max(1, Math.ceil(filteredMiners.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageMiners = filteredMiners.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function toggleRecent() {
    setRecentFirst((prev) => !prev)
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

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Buscar mineradores..."
          className="min-w-[240px] flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div className="flex gap-3">
          <div className="rounded-md border border-slate-600 bg-slate-900 px-4 py-2 text-center">
            <div className="text-xs uppercase tracking-wide text-slate-400">Mineradores</div>
            <div className="text-lg font-semibold text-white">
              {data.total.toLocaleString('en-US')}
            </div>
          </div>
          <div className="rounded-md border border-slate-600 bg-slate-900 px-4 py-2 text-center">
            <div className="text-xs uppercase tracking-wide text-slate-400">Merges</div>
            <div className="text-lg font-semibold text-white">
              {data.totalMerges.toLocaleString('en-US')}
            </div>
          </div>
        </div>

        <button
          onClick={toggleRecent}
          className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
            recentFirst
              ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
              : 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          Recentes
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {pageMiners.map((miner) => (
          <Link
            key={miner.id}
            to={`/mineradores/${miner.slug}`}
            className="group relative overflow-hidden rounded-lg border border-slate-600 bg-slate-900 transition-colors hover:border-indigo-500"
          >
            <div className="absolute left-2 top-2 z-10 flex gap-1">
              <StatusBadge ok={miner.sellable} label={miner.sellable ? 'Vendável' : 'Não vendável'} />
              <StatusBadge ok={miner.mergeable} label={miner.mergeable ? 'Mergeável' : 'Não mergeável'} />
            </div>

            <div className="flex aspect-square items-center justify-center bg-slate-800 p-4">
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
