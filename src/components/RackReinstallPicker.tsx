import type { RackInventoryOption } from '../hooks/useRemovedRacks'

function formatRackBonus(bonusCentesimos: number): string {
  const pct = bonusCentesimos / 100
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(2)}%`
}

// Modal simples de "escolher qual rack recolocar aqui" (Prompt 84, 1º
// gatilho de recolocação -- clique num slot vazio da sala). Sem filtro de
// "tamanho compatível" -- confirmado na investigação (ponto 5) que toda
// rack ocupa exatamente 1 célula da grade da sala, então QUALQUER rack
// serve pra QUALQUER posição vazia. Estrutura reaproveitada do SwapPicker
// (SimRackModal.tsx) -- mesma lista simples com imagem+nome, centralizada
// como modal cheio em vez de popover ancorado (mais simples, não precisa
// calcular posição relativa a um slot da sala escalada).
//
// Prompt 85: `entries` agora é a lista UNIFICADA (real desmontada +
// hipotética) -- badge "TESTE" marca as hipotéticas, sem filtro nenhum
// além do que o chamador (Simulador.tsx) já decidiu incluir (ele já tira
// hipotéticas com `remaining<=0` antes de montar essa lista).
export default function RackReinstallPicker({
  entries,
  onPick,
  onClose,
}: {
  entries: RackInventoryOption[]
  onPick: (key: string) => void
  onClose: () => void
}) {
  // Rack real (remaining undefined) sempre listada -- só sai do pool
  // quando reinstalada (takeOut), nunca fica "esgotada" enquanto está
  // aqui. Hipotética esgotada (remaining 0) some da lista (mesmo padrão do
  // SwapPicker pra miner) -- escolher algo sem cópia sobrando não faz
  // sentido aqui, ao contrário da aba RACKS, onde fica visível com
  // "restam 0" só informativamente.
  const options = entries.filter((e) => e.remaining === undefined || e.remaining > 0)
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
          {options.length === 0 ? (
            <p className="p-2 text-xs text-slate-500">Nenhuma rack disponível pra recolocar.</p>
          ) : (
            options.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => onPick(entry.key)}
                className="relative flex w-full items-center gap-2 rounded-md bg-slate-800/60 px-2 py-1.5 text-left hover:bg-slate-800"
              >
                {entry.image ? (
                  <img src={entry.image} alt="" className="h-8 w-8 shrink-0 object-contain" />
                ) : (
                  <span className="h-8 w-8 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-white">{entry.name}</span>
                  <span className="block text-[11px] text-slate-400">
                    Bônus {formatRackBonus(entry.bonus)}
                    {entry.isHypothetical && entry.remaining !== undefined ? ` · restam ${entry.remaining}` : ''}
                  </span>
                </span>
                {entry.isHypothetical && (
                  <span className="absolute right-1.5 top-1.5 rounded bg-amber-500 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-950">
                    Teste
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
