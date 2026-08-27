import Card from './Card'
import { formatPower } from '../utils/formatPower'
import type { AutoOptimizerResult } from '../utils/autoOptimizer'

// Resultado do Auto-Otimizador -- sempre PREVIEW local (nunca persiste,
// nunca altera o room-config real). Renderizado como card próprio, cheio
// da largura, abaixo da sala (mesmo padrão do painel de inventário
// importado -- controles compactos no stats panel, resultado full-width
// abaixo dele).
function RackLabel({
  rackName,
  roomLevel,
  y,
  x,
}: {
  rackName: string
  roomLevel: number
  y: number
  x: number
}) {
  return (
    <span className="text-slate-400">
      {rackName} (Sala {roomLevel}, linha {y + 1}, posição {x + 1})
    </span>
  )
}

export default function AutoOptimizerResults({ result }: { result: AutoOptimizerResult | null }) {
  if (!result) return null

  const delta = result.afterTotal - result.beforeTotal
  const deltaSign = delta >= 0 ? '+' : ''
  const deltaColor = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-400'

  const added = result.placements.filter((p) => p.origin === 'inventory')
  const movedInstalled = result.placements.filter((p) => p.origin === 'installed')

  return (
    <Card title="Resultado do Auto-Otimizador" className="mt-4">
      <p className="mb-3 text-[11px] text-slate-500">
        Simulação local -- nada foi salvo. Aplique manualmente no jogo se quiser.
      </p>

      <div className="grid grid-cols-3 gap-3 rounded-md border border-slate-800 bg-slate-950/40 p-3">
        <div>
          <p className="text-xs text-slate-400">Antes</p>
          <p className="text-sm font-semibold text-slate-200">{formatPower(result.beforeTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Depois</p>
          <p className="text-sm font-semibold text-slate-200">{formatPower(result.afterTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Diferença</p>
          <p className={`text-sm font-semibold ${deltaColor}`}>
            {deltaSign}
            {formatPower(delta)}
          </p>
        </div>
      </div>

      {added.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-slate-300">
            Adicionados do inventário ({added.length})
          </p>
          <ul className="max-h-56 space-y-1 overflow-y-auto text-xs text-slate-300">
            {added.map((p) => (
              <li key={p.instanceKey} className="flex items-center justify-between gap-2">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-slate-500">
                  {formatPower(p.power)} -&gt; <RackLabel rackName={p.rackName} roomLevel={p.roomLevel} y={p.y} x={p.x} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {movedInstalled.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-slate-300">
            Mineradores já instalados que mudaram de posição ({movedInstalled.length})
          </p>
          <ul className="max-h-56 space-y-1 overflow-y-auto text-xs text-slate-300">
            {movedInstalled.map((p) => (
              <li key={p.instanceKey} className="flex items-center justify-between gap-2">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-slate-500">
                  {formatPower(p.power)} -&gt; <RackLabel rackName={p.rackName} roomLevel={p.roomLevel} y={p.y} x={p.x} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.removedInstalled.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-amber-400">
            Removidos da sala ({result.removedInstalled.length}) -- não voltam pro inventário, só saem da
            simulação
          </p>
          <ul className="max-h-56 space-y-1 overflow-y-auto text-xs text-slate-300">
            {result.removedInstalled.map((r) => (
              <li key={r.instanceKey} className="flex items-center justify-between gap-2">
                <span className="truncate">{r.name}</span>
                <span className="shrink-0 text-slate-500">{formatPower(r.power)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.emptySlots.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-slate-300">
            Espaços vazios remanescentes ({result.emptySlots.length})
          </p>
          <p className="mb-1.5 text-[11px] text-slate-500">
            {result.emptySlots[0].reason === 'sem_orcamento'
              ? 'Motivo: o teto de poder escolhido foi atingido antes de preencher tudo.'
              : 'Motivo: não sobrou minerador compatível (instalado ou do inventário) pra preencher.'}
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-slate-500">
            {result.emptySlots.map((s, i) => (
              <li key={`${s.rackInstanceId}-${s.y}-${s.x}-${i}`}>
                <RackLabel rackName={s.rackName} roomLevel={s.roomLevel} y={s.y} x={s.x} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {added.length === 0 &&
        movedInstalled.length === 0 &&
        result.removedInstalled.length === 0 &&
        result.emptySlots.length === 0 && (
          <p className="mt-3 text-sm text-slate-400">Nenhuma mudança -- a sala já está no melhor arranjo possível.</p>
        )}
    </Card>
  )
}
