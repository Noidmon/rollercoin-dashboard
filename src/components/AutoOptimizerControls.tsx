import SortDropdown, { type SortDropdownOption } from './SortDropdown'
import { formatPower } from '../utils/formatPower'
import { buildLeagueCeilingOptions } from '../hooks/useAutoOptimizer'
import type { OptimizerMode, OptimizerPriority } from '../utils/autoOptimizer'

// Formulário compacto do Auto-Otimizador -- fica dentro do painel de stats
// da sala (RoomStatsPanel), perto de InventoryPasteField. O resultado
// (antes/depois, mudanças) renderiza separado, abaixo da sala
// (AutoOptimizerResults), mesmo padrão já usado pro painel de inventário
// (Prompt 58: campo de colar no stats, resultado full-width abaixo).
const PRIORITY_OPTIONS: SortDropdownOption<OptimizerPriority>[] = [
  { value: 'padrao', label: 'Padrão' },
  { value: 'poder_bruto', label: 'Poder Bruto' },
]

export default function AutoOptimizerControls({
  priority,
  onPriorityChange,
  mode,
  onModeChange,
  leagueIndex,
  onLeagueIndexChange,
  onOptimize,
  disabled,
}: {
  priority: OptimizerPriority
  onPriorityChange: (v: OptimizerPriority) => void
  mode: OptimizerMode
  onModeChange: (v: OptimizerMode) => void
  leagueIndex: number
  onLeagueIndexChange: (v: number) => void
  onOptimize: () => void
  disabled: boolean
}) {
  const leagueOptions = buildLeagueCeilingOptions(formatPower)
  const leagueDropdownOptions: SortDropdownOption<string>[] = leagueOptions.map((o) => ({
    value: String(o.index),
    label: o.label,
  }))

  return (
    <div className="border-t border-slate-800 pt-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">Auto-Otimizador</p>

      <label className="mb-1 mt-2 block text-[11px] text-slate-500">Prioridade</label>
      <SortDropdown
        options={PRIORITY_OPTIONS}
        value={priority}
        onChange={onPriorityChange}
        buttonClassName="w-full truncate"
      />

      <label className="mb-1 mt-2 block text-[11px] text-slate-500">Modo</label>
      <div className="flex gap-1.5">
        {(
          [
            { value: 'maximo_poder', label: 'Máximo poder' },
            { value: 'preservar_sala', label: 'Preservar sala' },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onModeChange(option.value)}
            className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
              mode === option.value
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="mb-1 mt-2 block text-[11px] text-slate-500">Teto de poder (liga)</label>
      <SortDropdown
        options={leagueDropdownOptions}
        value={String(leagueIndex)}
        onChange={(v) => onLeagueIndexChange(Number(v))}
        buttonClassName="w-full truncate"
      />

      <button
        type="button"
        onClick={onOptimize}
        disabled={disabled}
        className="mt-3 w-full rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Otimizar
      </button>
      {disabled && (
        <p className="mt-1.5 text-[11px] text-slate-500">Importe um inventário pra poder otimizar.</p>
      )}
    </div>
  )
}
