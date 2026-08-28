import { useEffect, useState } from 'react'
import { CURRENT_EVENT } from '../data/currentEvent'
import { getRewardImageUrl } from '../utils/parseEventJson'
import { resolveAssetUrl } from '../utils/resolveAssetUrl'
import { withBase } from '../utils/withBase'
import {
  calculateRecommendedMultiplier,
  calculateEventRewardSummary,
  getTaskXpReward,
} from '../utils/calculateEventProfitability'
import Card from '../components/Card'
import type { EventData } from '../types/event'
import type { MinersData } from '../types/miner'

const DISCOUNT_OPTIONS = [0, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]
const BOX_PRICE_OPTIONS = [1.99, 3.99, 11.99, 29.99]

// Todos os inteiros de 1 a 1000, sem pular nenhum -- select nativo lida bem
// com 1000 <option>, sem precisar de virtualização (confirmado com teste
// visual). 1000 bate com KNOWN_MAX_MULTIPLIER de calculateEventProfitability.ts,
// então o multiplicador recomendado sempre cai dentro dessa faixa.
function generateMultiplierOptions(): number[] {
  return Array.from({ length: 1000 }, (_, i) => i + 1)
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

function extractMergeLevel(name: string): number | null {
  const match = name.match(/\(L(\d+)\)/)
  return match ? Number(match[1]) : null
}

function looksLikeEventData(value: unknown): value is EventData {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as EventData).name === 'string' &&
    Array.isArray((value as EventData).rewards) &&
    Array.isArray((value as EventData).tasks)
  )
}

function RewardImage({
  imagePath,
  minerSlug,
  minerImageBySlug,
  name,
  mergeLevel,
  sellable,
}: {
  imagePath: string
  // Recompensas reference_type "miner"/"merge" carregam o slug do
  // minerador -- resolvemos a imagem pelo catálogo LOCAL já sincronizado
  // via sync-miners-data.js (miners.json) em vez de chamar
  // resolveAssetUrl(image_path) direto, que cairia no fallback externo
  // (esses caminhos rollercoin/miners/*.gif nunca são sincronizados por
  // sync-rc-icons.js). null quando a recompensa não é de minerador, ou
  // quando o catálogo ainda não carregou/não achou o slug -- nesses casos
  // cai no comportamento antigo abaixo.
  minerSlug: string | null
  minerImageBySlug: Map<string, string> | null
  name: string
  mergeLevel: number | null
  sellable: boolean | null
}) {
  const [failed, setFailed] = useState(false)

  const localMinerImage = minerSlug ? minerImageBySlug?.get(minerSlug) : undefined
  const src = localMinerImage ?? getRewardImageUrl(imagePath)

  return (
    <div className="relative z-0 h-10 w-10 shrink-0">
      {failed ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-800 text-slate-600">
          ?
        </div>
      ) : (
        <img
          src={src}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-10 w-10 rounded-md bg-slate-800 object-contain"
        />
      )}
      {mergeLevel !== null && (
        <img
          src={resolveAssetUrl(`rollercoin/levels/level_${mergeLevel}.webp`)}
          alt={`Nível ${mergeLevel}`}
          className="absolute -left-1 -top-1 h-4 w-4"
        />
      )}
      {sellable === false && (
        <img
          src={resolveAssetUrl('rollercoin/icons/sellable_disabled.webp')}
          alt="Não vendável"
          className="absolute -right-1 -top-1 h-4 w-4"
        />
      )}
    </div>
  )
}

export default function Eventos() {
  const [event, setEvent] = useState<EventData | null>(null)

  // Catálogo local de mineradores -- só usado pra resolver a imagem de
  // recompensas reference_type "miner"/"merge" pelo slug (miners.json já
  // tem essas imagens sincronizadas via sync-miners-data.js). Carregado em
  // paralelo ao evento; se falhar, RewardImage cai no resolveAssetUrl do
  // image_path cru de sempre.
  const [minerImageBySlug, setMinerImageBySlug] = useState<Map<string, string> | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(withBase('/data/miners.json'))
      .then((res) => (res.ok ? (res.json() as Promise<MinersData>) : Promise.reject(res)))
      .then((data) => {
        if (cancelled) return
        const map = new Map<string, string>()
        for (const m of data.miners) {
          if (m.image) map.set(m.slug, withBase(m.image))
        }
        setMinerImageBySlug(map)
      })
      .catch(() => {
        // sem catálogo local -- RewardImage segue funcionando via
        // resolveAssetUrl(image_path), só sem o atalho local
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadEvent() {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_PROXY_URL}/api/progression-data/current`,
        )
        if (response.ok) {
          const data = await response.json()
          if (looksLikeEventData(data)) {
            if (!cancelled) {
              setEvent(data)
            }
            return
          }
        }
      } catch {
        // erro de rede -- cai no fallback abaixo
      }

      if (!cancelled) {
        setEvent(CURRENT_EVENT)
      }
    }

    loadEvent()
    return () => {
      cancelled = true
    }
  }, [])

  if (!event) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Eventos</h1>
        <p className="mt-4 text-sm text-slate-400">Carregando evento...</p>
      </div>
    )
  }

  return <EventosContent event={event} minerImageBySlug={minerImageBySlug} />
}

function EventosContent({
  event,
  minerImageBySlug,
}: {
  event: EventData
  minerImageBySlug: Map<string, string> | null
}) {
  const recommendation = calculateRecommendedMultiplier(event)
  const rewardSummary = calculateEventRewardSummary(event)
  const multiplierHours = event.multiplier_ttl_ms / 3_600_000
  const baseMultiplier = parseFloat(event.multiplier_exchange_rlt)

  const gameLevelXp = getTaskXpReward(event.tasks, 'game_level')
  const spendRltXp = getTaskXpReward(event.tasks, 'spend_rlt')
  const marketplaceXp = getTaskXpReward(event.tasks, 'marketplace')

  const multiplierOptions = generateMultiplierOptions()

  const [multiplier, setMultiplier] = useState(recommendation.recommended)
  const [discount, setDiscount] = useState(event.default_discount_percent ?? 0)
  const [boxPrice, setBoxPrice] = useState(1.99)

  const rltToBuy = Math.floor((multiplier - 1) / baseMultiplier)
  const rltWithDiscount = Math.round((rltToBuy - rltToBuy * (discount / 100)) * 100) / 100

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Eventos</h1>

      {/* Coluna esquerda não encolhe (conteúdo ~830px); abaixo de ~942px de
          altura de viewport, a página rola normalmente — comportamento
          aceito, não é bug. */}
      <div className="mt-4 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[320px_1fr] lg:h-[calc(100vh-112px)] lg:grid-rows-[minmax(0,1fr)]">
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

        <div className="flex h-full min-h-0 flex-col gap-4">
          <Card title="Calculadora de Recompensas">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Multiplicador</label>
                <select
                  value={multiplier}
                  onChange={(e) => setMultiplier(Number(e.target.value))}
                  className={`w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    multiplier === recommendation.recommended ? 'text-emerald-400' : 'text-white'
                  }`}
                >
                  {multiplierOptions.map((m) => (
                    <option
                      key={m}
                      value={m}
                      style={{ color: m === recommendation.recommended ? '#34d399' : '#ffffff' }}
                    >
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
                <thead className="sticky top-0 z-10 bg-slate-900">
                  <tr className="border-b border-slate-800 text-xs uppercase text-slate-400">
                    <th className="py-2 pr-3 font-medium">Nível</th>
                    <th className="py-2 pr-3 font-medium">Total</th>
                    <th className="py-2 pr-3 font-medium">Pontos</th>
                    <th className="py-2 pr-3 font-medium"></th>
                    <th className="py-2 pr-3 font-medium">Nome</th>
                    <th className="py-2 pr-3 font-medium">Valor</th>
                    <th className="py-2 pr-3 font-medium">Caixas</th>
                    <th className="py-2 pr-3 font-medium">Mercado</th>
                    <th className="py-2 pr-3 font-medium">Jogos</th>
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

                    // Cada level-up de dificuldade em minigame = xp_reward da task
                    // "game_level" (multiplicador se aplica ao XP ganho), mas requer
                    // jogar 3 partidas pra disparar um level-up.
                    // ASSUNÇÃO: confirmar com o usuário se "3 jogos por level-up" é
                    // sempre fixo, ou varia por dificuldade/jogo.
                    const games =
                      gameLevelXp > 0
                        ? Math.ceil(reward.required_xp / (gameLevelXp * multiplier)) * 3
                        : null

                    const mergeLevel = extractMergeLevel(reward.name)

                    return (
                      <tr key={reward.reward_id} className="border-b border-slate-800/60">
                        <td className="py-2 pr-3 text-slate-300">
                          {reward.required_level}
                        </td>
                        <td className="py-2 pr-3 text-slate-300">
                          {reward.required_xp.toLocaleString('en-US')}
                        </td>
                        <td className="py-2 pr-3 text-slate-300">
                          {reward.level_xp.toLocaleString('en-US')}
                        </td>
                        <td className="py-2 pr-3">
                          <RewardImage
                            imagePath={reward.image_path}
                            minerSlug={reward.miner_slug}
                            minerImageBySlug={minerImageBySlug}
                            name={reward.name}
                            mergeLevel={mergeLevel}
                            sellable={reward.sellable}
                          />
                        </td>
                        <td className="py-2 pr-3 text-slate-200">{reward.name}</td>
                        <td className="py-2 pr-3 text-slate-200">{reward.value_text}</td>
                        <td className="py-2 pr-3 text-slate-300">{boxes ?? '--'}</td>
                        <td className="py-2 pr-3 text-slate-300">{marketRlt ?? '--'}</td>
                        <td className="py-2 pr-3 text-slate-300">{games ?? '--'}</td>
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
