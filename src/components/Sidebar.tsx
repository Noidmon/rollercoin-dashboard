import { NavLink } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'

const navItems = [
  { label: 'Início', path: '/' },
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Calculadora', path: '/calculadora' },
  { label: 'Merges', path: '/merges' },
  { label: 'Hamsters', path: '/hamsters' },
  { label: 'Eventos', path: '/eventos' },
  { label: 'Simulador', path: '/simulador' },
]

export default function Sidebar() {
  const { nickname, setNickname, loading, error, refetch } = usePlayer()

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
      <div className="px-6 py-5">
        <span className="text-lg font-semibold text-white">RollerCoin</span>
        <span className="block text-xs text-slate-400">Dashboard</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-800 px-3 py-4">
        <label className="mb-1 block text-xs text-slate-400">Jogador</label>
        <div className="flex gap-1">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && refetch()}
            placeholder="Nickname"
            className="w-full min-w-0 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? '...' : 'Buscar'}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
    </aside>
  )
}
