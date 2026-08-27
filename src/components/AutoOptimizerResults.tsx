import Card from './Card'
import { formatPower } from '../utils/formatPower'
import type { AutoOptimizerResult } from '../utils/autoOptimizer'

// Detalhe COMPLEMENTAR do resultado (Prompt 65) -- a entrega principal
// agora é a visualização da sala em si (aba "Simulação", ver
// AutoOptimizerSummary + RoomRacksLayer com result.simulatedMiners); esse
// card só lista o "porquê" em texto (quais mudaram, o que ficou vazio e
// por quê), sem repetir antes/depois/diferença (já mostrado no resumo
// acima da sala).
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

  const added = result.placements.filter((p) => p.origin === 'inventory')
  const movedInstalled = result.placements.filter((p) => p.origin === 'installed')

  return (
    <Card title="Detalhes da Simulação" className="mt-4">
      {result.iterativeSearch && (
        <p className="mb-3 text-[11px] text-slate-500">
          Busca iterativa (Máximo poder): {result.iterativeSearch.iterations} iteração
          {result.iterativeSearch.iterations === 1 ? '' : 'ões'}
          {result.iterativeSearch.converged
            ? ', convergiu'
            : ' -- bateu o limite de segurança sem convergir, pode haver mais espaço pra melhorar'}
          {' '}em {result.iterativeSearch.elapsedMs}ms.
        </p>
      )}

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
