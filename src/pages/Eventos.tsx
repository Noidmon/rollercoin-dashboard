import { useState } from 'react'
import { CURRENT_EVENT } from '../data/currentEvent'
import { getRewardImageUrl } from '../utils/parseEventJson'
import { calculateRecommendedMultiplier } from '../utils/calculateEventProfitability'
import Card from '../components/Card'

function scoreColorClass(score: number): string {
  if (score < 4) return 'text-red-400'
  if (score <= 7) return 'text-yellow-400'
  return 'text-emerald-400'
}

function formatCountdown(endDateIso: string): string {
  const diffMs = new Date(endDateIso).getTime() - Date.now()
  if (!Number.isFinite(diffMs)) return '--'
  if (diffMs <= 0) return 'Encerrado'

  const totalMinutes = Math.floor(diffMs / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  return `${days}d : ${hours}h : ${minutes}m`
}

function formatNumber(value: number, maximumFractionDigits = 2): string {
  return Number.isFinite(value)
    ? value.toLocaleString('en-US', { maximumFractionDigits })
    : '--'
}

function RewardImage({ imagePath, name }: { imagePath: string; name: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-800 text-slate-600">
        ?
      </div>
    )
  }

  return (
    <img
      src={getRewardImageUrl(imagePath)}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-10 w-10 shrink-0 rounded-md bg-slate-800 object-contain"
    />
  )
}

export default function Eventos() {
  const event = CURRENT_EVENT
  const recommendation = calculateRecommendedMultiplier(event)
  const multiplierHours = event.multiplier_ttl_ms / 3_600_000

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Eventos</h1>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4 lg:sticky lg:top-8 lg:h-fit">
          {event.cover_image_path && (
            <img
              src={getRewardImageUrl(event.cover_image_path)}
              alt={event.name}
              loading="lazy"
              className="w-full rounded-lg border border-slate-800 object-cover"
            />
          )}

          <div>
            <h2 className="text-xl font-semibold text-white">{event.name}</h2>
            <p className="mt-1 text-sm font-semibold text-indigo-300">
              {formatCountdown(event.end_date)}
            </p>
          </div>

          <Card title="Recomendação">
            <p className="text-xs text-slate-500">
              Fórmula reimplementada por conta própria a partir de comportamento
              observado publicamente, só para cálculo pessoal — não é código de
              terceiros.
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Valor Total</span>
                <span className="font-semibold text-slate-200">
                  {formatNumber(recommendation.totalValue)} RLT
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Multiplicador Recomendado</span>
                <span className="font-semibold text-indigo-300">
                  {recommendation.recommended}x
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">RLT a Comprar</span>
                <span className="font-semibold text-slate-200">
                  {formatNumber(recommendation.rltToBuy, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Ratio</span>
                <span className="font-semibold text-slate-200">
                  {formatNumber(recommendation.ratio)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Nota</span>
                <span
                  className={`font-semibold ${scoreColorClass(recommendation.score)}`}
                >
                  {formatNumber(recommendation.score, 1)}/10
                </span>
              </div>
            </div>
          </Card>

          <Card title="Dificuldade">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Multiplicador base</span>
                <span className="text-slate-200">
                  {parseFloat(event.multiplier_exchange_rlt)}x
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Duração do multiplicador</span>
                <span className="text-slate-200">{multiplierHours}h</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Desconto padrão</span>
                <span className="text-slate-200">{event.default_discount_percent}%</span>
              </div>
            </div>
          </Card>
        </div>

        <div>
          <Card title="Recompensas">
            <div className="max-h-[75vh] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="sticky top-0 border-b border-slate-800 bg-slate-900 text-xs uppercase text-slate-400">
                    <th className="py-2 pr-3 font-medium"></th>
                    <th className="py-2 pr-3 font-medium">Nível</th>
                    <th className="py-2 pr-3 font-medium">Pontos</th>
                    <th className="py-2 pr-3 font-medium">Nome</th>
                    <th className="py-2 pr-3 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {event.rewards.map((reward) => (
                    <tr key={reward.reward_id} className="border-b border-slate-800/60">
                      <td className="py-2 pr-3">
                        <RewardImage imagePath={reward.image_path} name={reward.name} />
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {reward.required_level}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {reward.level_xp.toLocaleString('en-US')}
                      </td>
                      <td className="py-2 pr-3 text-slate-200">{reward.name}</td>
                      <td className="py-2 pr-3 text-slate-200">{reward.value_text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
