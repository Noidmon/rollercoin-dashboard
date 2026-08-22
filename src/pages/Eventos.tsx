import { useState } from 'react'
import { CURRENT_EVENT } from '../data/currentEvent'
import { getRewardImageUrl } from '../utils/parseEventJson'
import {
  calculateRecommendedMultiplier,
  calculateEventRewardSummary,
  getTaskXpReward,
} from '../utils/calculateEventProfitability'
import Card from '../components/Card'

const DISCOUNT_OPTIONS = [0, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]
const BOX_PRICE_OPTIONS = [1.99, 3.99, 11.99, 29.99]

function generateMultiplierOptions(recommended: number): number[] {
  const options = new Set<number>()
  for (let i = 1; i <= 50; i++) options.add(i)
  for (let i = 55; i <= 100; i += 5) options.add(i)
  for (let i = 110; i <= 1000; i += 10) options.add(i)
  options.add(recommended)
  return Array.from(options).sort((a, b) => a - b)
}

function scoreColorClass(score: number): string {
  if (score < 4) return 'text-red-400'
  if (score <= 7) return 'text-yellow-400'
  return 'text-emerald-400'
}

function formatEndDate(endDateIso: string): string {
  const date = new Date(endDateIso)
  if (Number.isNaN(date.getTime())) return 'Termina em --'

  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = date.getUTCFullYear()
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')

  return `Termina em ${dd}/${mm}/${yyyy} ${hh}:${min} UTC`
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
  const rewardSummary = calculateEventRewardSummary(event)
  const multiplierHours = event.multiplier_ttl_ms / 3_600_000
  const baseMultiplier = parseFloat(event.multiplier_exchange_rlt)

  const gameLevelXp = getTaskXpReward(event.tasks, 'game_level')
  const spendRltXp = getTaskXpReward(event.tasks, 'spend_rlt')
  const marketplaceXp = getTaskXpReward(event.tasks, 'marketplace')

  const multiplierOptions = generateMultiplierOptions(recommendation.recommended)

  const [multiplier, setMultiplier] = useState(recommendation.recommended)
  const [discount, setDiscount] = useState(event.default_discount_percent)
  const [boxPrice, setBoxPrice] = useState(1.99)

  const rltToBuy = Math.floor((multiplier - 1) / baseMultiplier)
  const rltWithDiscount = Math.round((rltToBuy - rltToBuy * (discount / 100)) * 100) / 100

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Eventos</h1>

      <div className="mt-4 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[320px_1fr] lg:h-[calc(100vh-140px)]">
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
              {formatEndDate(event.end_date)}
            </p>
          </div>

          <Card title="Recomendação">
            <div className="space-y-2">
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
                <span className="text-slate-400">Multiplicador</span>
                <span className="text-slate-200">{baseMultiplier}x por 1 RLT</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Duração do multiplicador</span>
                <span className="text-slate-200">{multiplierHours}h</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Dificuldade do jogo</span>
                <span className="text-slate-200">{gameLevelXp} XP</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Gastar 1 RLT</span>
                <span className="text-slate-200">{spendRltXp} XP</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Marketplace</span>
                <span className="text-slate-200">{marketplaceXp} XP</span>
              </div>
            </div>
          </Card>

          <Card title="Recompensas Totais do Evento">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Poder de Miners</span>
                <span className="text-slate-200">
                  {formatNumber(rewardSummary.minersPowerGhS, 0)} Gh/s
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Bônus de Miners</span>
                <span className="text-slate-200">{rewardSummary.minersBonusPercent}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Poder Temporário</span>
                <span className="text-slate-200">
                  {formatNumber(rewardSummary.temporaryPowerGhS, 0)} Gh/s
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">RST</span>
                <span className="text-slate-200">{rewardSummary.rst}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">RLT</span>
                <span className="text-slate-200">{rewardSummary.rlt}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Season XP</span>
                <span className="text-slate-200">{rewardSummary.seasonExp}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex h-full flex-col gap-4">
          <Card title="Calculadora de Recompensas">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Multiplicador</label>
                <select
                  value={multiplier}
                  onChange={(e) => setMultiplier(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {multiplierOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}x
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Desconto</label>
                <select
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {DISCOUNT_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}%
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Caixa</label>
                <select
                  value={boxPrice}
                  onChange={(e) => setBoxPrice(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {BOX_PRICE_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b} RLT
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-400">RLT a Comprar</p>
                <p className="rounded-md border border-slate-800 bg-slate-800/50 px-2 py-2 text-white">
                  {rltToBuy}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-400">RLT com Desconto</p>
                <p className="rounded-md border border-slate-800 bg-slate-800/50 px-2 py-2 text-white">
                  {rltWithDiscount}
                </p>
              </div>
            </div>
          </Card>

          <Card
            title="Recompensas"
            className="flex flex-1 flex-col min-h-0"
            contentClassName="flex flex-1 flex-col min-h-0"
          >
            <div className="flex-1 min-h-0 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="sticky top-0 border-b border-slate-800 bg-slate-900 text-xs uppercase text-slate-400">
                    <th className="py-2 pr-3 font-medium"></th>
                    <th className="py-2 pr-3 font-medium">Nível</th>
                    <th className="py-2 pr-3 font-medium">Total</th>
                    <th className="py-2 pr-3 font-medium">Pontos</th>
                    <th className="py-2 pr-3 font-medium">Nome</th>
                    <th className="py-2 pr-3 font-medium">Valor</th>
                    <th className="py-2 pr-3 font-medium">Caixas</th>
                    <th className="py-2 pr-3 font-medium">Mercado</th>
                  </tr>
                </thead>
                <tbody>
                  {event.rewards.map((reward) => {
                    const boxes =
                      spendRltXp > 0
                        ? Math.ceil(
                            reward.required_xp / (spendRltXp * boxPrice * multiplier),
                          )
                        : null
                    const marketRlt =
                      marketplaceXp > 0
                        ? Math.ceil(reward.required_xp / (marketplaceXp * multiplier))
                        : null

                    return (
                      <tr key={reward.reward_id} className="border-b border-slate-800/60">
                        <td className="py-2 pr-3">
                          <RewardImage imagePath={reward.image_path} name={reward.name} />
                        </td>
                        <td className="py-2 pr-3 text-slate-300">
                          {reward.required_level}
                        </td>
                        <td className="py-2 pr-3 text-slate-300">
                          {reward.required_xp.toLocaleString('en-US')}
                        </td>
                        <td className="py-2 pr-3 text-slate-300">
                          {reward.level_xp.toLocaleString('en-US')}
                        </td>
                        <td className="py-2 pr-3 text-slate-200">{reward.name}</td>
                        <td className="py-2 pr-3 text-slate-200">{reward.value_text}</td>
                        <td className="py-2 pr-3 text-slate-300">{boxes ?? '--'}</td>
                        <td className="py-2 pr-3 text-slate-300">{marketRlt ?? '--'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
