import type { RemovedRackEntry } from '../hooks/useRemovedRacks'

function formatRackBonus(bonusCentesimos: number): string {
  const pct = bonusCentesimos / 100
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(2)}%`
}

// Modal simples de "escolher qual rack desmontada recolocar aqui" (Prompt
// 84, 1º gatilho de recolocação -- clique num slot vazio da sala). Sem
// filtro de "tamanho compatível" -- confirmado na investigação (ponto 5)
// que toda rack ocupa exatamente 1 célula da grade da sala, então QUALQUER
// rack desmontada serve pra QUALQUER posição vazia. Estrutura reaproveitada
// do SwapPicker (SimRackModal.tsx) -- mesma lista simples com imagem+nome,
// centralizada como modal cheio em vez de popover ancorado (mais simples,
// não precisa calcular posição relativa a um slot da sala escalada).
export default function RackReinstallPicker({
  entries,
  onPick,
  onClose,
}: {
  entries: RemovedRackEntry[]
  onPick: (rackInstanceId: string) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">Recolocar rack</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-700"
          >
            ✕
          </button>
        </div>
        <div className="space-y-1 overflow-y-auto p-3">
          {entries.length === 0 ? (
            <p className="p-2 text-xs text-slate-500">Nenhuma rack desmontada disponível pra recolocar.</p>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => onPick(entry.key)}
                className="flex w-full items-center gap-2 rounded-md bg-slate-800/60 px-2 py-1.5 text-left hover:bg-slate-800"
              >
                {entry.image ? (
                  <img src={entry.image} alt="" className="h-8 w-8 shrink-0 object-contain" />
                ) : (
                  <span className="h-8 w-8 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-white">
                    {entry.rack.name ?? entry.rack._id}
                  </span>
                  <span className="block text-[11px] text-slate-400">Bônus {formatRackBonus(entry.rack.bonus)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
