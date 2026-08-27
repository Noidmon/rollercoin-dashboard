import { formatPower } from '../utils/formatPower'
import type { AutoOptimizerResult } from '../utils/autoOptimizer'

// Resumo compacto do resultado -- inspirado no card verde da referência
// real (SmartRoom, Prompt 65): poder atual -> estimado (com temporário,
// igual ao que o jogo mostra), bônus atual -> estimado, poder SEM
// temporário atual -> estimado (a métrica que realmente decide a liga), e
// uma linha de "Limite X -- usando Y%, folga Z".
export default function AutoOptimizerSummary({
  result,
  currentPowerWithTemp,
}: {
  result: AutoOptimizerResult
  // playerData.current_power (já inclui games+temp) -- usado como âncora
  // pra "poder atual" com temporário; a estimativa soma só o delta
  // sem-temporário (games/temp não mudam com a reorganização).
  currentPowerWithTemp: number
}) {
  const delta = result.afterTotal - result.beforeTotal
  const estimatedPowerWithTemp = currentPowerWithTemp + delta

  const beforeBonusPct = result.beforeBonusPercent / 100
  const afterBonusPct = result.afterBonusPercent / 100
  const bonusPctDelta = afterBonusPct - beforeBonusPct

  const usagePercent = result.ceilingGhs > 0 && Number.isFinite(result.ceilingGhs)
    ? (result.afterTotal / result.ceilingGhs) * 100
    : 0
  const folga = Number.isFinite(result.ceilingGhs) ? result.ceilingGhs - result.afterTotal : Infinity

  const deltaColor = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-400'

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            {formatPower(result.beforeTotal)} <span className="text-slate-500">-&gt;</span>{' '}
            <span className="font-semibold text-white">{formatPower(result.afterTotal)}</span>
          </p>
          <p className={`text-xs font-semibold ${deltaColor}`}>
            {delta >= 0 ? '+' : ''}
            {formatPower(delta)}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-emerald-700/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
        <span className="font-semibold">
          Limite {Number.isFinite(result.ceilingGhs) ? formatPower(result.ceilingGhs) : 'sem teto'}
        </span>
        {Number.isFinite(result.ceilingGhs) && (
          <>
            {' '}
            -- usando {usagePercent.toFixed(1)}%, folga de {formatPower(folga)}
          </>
        )}
      </div>
    </div>
  )
}
