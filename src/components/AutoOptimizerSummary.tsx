import { formatPower } from '../utils/formatPower'
import type { LiveOptimizerSummary } from '../hooks/useAutoOptimizer'

// Resumo compacto -- inspirado no card verde da referência real (SmartRoom,
// Prompt 65): poder atual -> estimado (com temporário, igual ao que o jogo
// mostra), bônus atual -> estimado, poder SEM temporário atual -> estimado
// (a métrica que realmente decide a liga), e uma linha de "Limite X --
// usando Y%, folga Z".
//
// Recebe `summary` (LiveOptimizerSummary, useAutoOptimizer.ts) em vez do
// `result` do último run do otimizador (Prompt 72) -- summary é recalculado
// AO VIVO a partir de simRoom a cada render, então atualiza sozinho com
// qualquer edição manual do modal de rack, não só depois de rodar
// Otimizar (bug real corrigido, ver comentário no hook).
export default function AutoOptimizerSummary({
  summary,
  currentPowerWithTemp,
}: {
  summary: LiveOptimizerSummary
  // playerData.current_power (já inclui games+temp) -- usado como âncora
  // pra "poder atual" com temporário; a estimativa soma só o delta
  // sem-temporário (games/temp não mudam com a reorganização).
  currentPowerWithTemp: number
}) {
  const delta = summary.afterTotal - summary.beforeTotal
  const estimatedPowerWithTemp = currentPowerWithTemp + delta

  const beforeBonusPct = summary.beforeBonusPercent / 100
  const afterBonusPct = summary.afterBonusPercent / 100
  const bonusPctDelta = afterBonusPct - beforeBonusPct

  const usagePercent = summary.ceilingGhs > 0 && Number.isFinite(summary.ceilingGhs)
    ? (summary.afterTotal / summary.ceilingGhs) * 100
    : 0
  const folga = Number.isFinite(summary.ceilingGhs) ? summary.ceilingGhs - summary.afterTotal : Infinity

  const deltaColor = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-400'

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      {/* Empilhado (1 coluna) -- esse card mora na coluna estreita do
          lado direito da sala (Prompt 66, embaixo do botão Otimizar), não
          mais no espaço largo entre as abas e o visual. */}
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Poder Atual</p>
          <p className="text-sm text-slate-200">
            {formatPower(currentPowerWithTemp)} <span className="text-slate-500">-&gt;</span>{' '}
            <span className="font-semibold text-white">{formatPower(estimatedPowerWithTemp)}</span>
          </p>
          <p className={`text-xs font-semibold ${deltaColor}`}>
            {delta >= 0 ? '+' : ''}
            {formatPower(delta)}
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Bônus Atual</p>
          <p className="text-sm text-slate-200">
            +{beforeBonusPct.toFixed(2)}% <span className="text-slate-500">-&gt;</span>{' '}
            <span className="font-semibold text-white">+{afterBonusPct.toFixed(2)}%</span>
          </p>
          <p className={`text-xs font-semibold ${bonusPctDelta >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {bonusPctDelta >= 0 ? '+' : ''}
            {bonusPctDelta.toFixed(2)}%
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Sem Temporário</p>
          <p className="text-sm text-slate-200">
            {formatPower(summary.beforeTotal)} <span className="text-slate-500">-&gt;</span>{' '}
            <span className="font-semibold text-white">{formatPower(summary.afterTotal)}</span>
          </p>
          <p className={`text-xs font-semibold ${deltaColor}`}>
            {delta >= 0 ? '+' : ''}
            {formatPower(delta)}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-emerald-700/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
        <span className="font-semibold">
          Limite {Number.isFinite(summary.ceilingGhs) ? formatPower(summary.ceilingGhs) : 'sem teto'}
        </span>
        {Number.isFinite(summary.ceilingGhs) && (
          <>
            {' '}
            -- usando {usagePercent.toFixed(1)}%, folga de {formatPower(folga)}
          </>
        )}
      </div>
    </div>
  )
}
