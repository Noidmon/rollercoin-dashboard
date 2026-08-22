import { useState } from 'react'
import { parseEventJson, getRewardImageUrl } from '../utils/parseEventJson'
import { calculateRecommendedMultiplier } from '../utils/calculateEventProfitability'
import type { EventData } from '../types/event'
import Card from '../components/Card'

const STORAGE_KEY = 'rollercoin-dashboard:event-json'

function loadStoredEvent(): EventData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? parseEventJson(raw) : null
  } catch {
    return null
  }
}

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
  const [rawInput, setRawInput] = useState('')
  const [event, setEvent] = useState<EventData | null>(loadStoredEvent)
  const [parseError, setParseError] = useState<string | null>(null)

  function handleImport() {
    setParseError(null)

    try {
      const parsed = parseEventJson(rawInput)
      setEvent(parsed)
      localStorage.setItem(STORAGE_KEY, rawInput)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err))
    }
  }

  const recommendation = event ? calculateRecommendedMultiplier(event) : null

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Eventos</h1>

      <div className="mt-4 space-y-4">
        <Card title="Importar Evento">
          <p className="text-xs text-slate-500">
            Abra a página do evento atual no jogo, F12 → Network → Fetch/XHR →
            recarregue → ache a chamada com o nome/slug do evento → aba Response →
            copie o JSON e cole aqui. É um fluxo manual e ocasional, sem automação.
          </p>
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            rows={6}
            placeholder="Cole aqui o JSON do evento..."
            className="mt-3 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleImport}
            className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Importar
          </button>
          {parseError && <p className="mt-2 text-sm text-red-400">{parseError}</p>}
          {event && !parseError && (
            <p className="mt-2 text-sm text-emerald-400">
              {event.rewards.length} recompensa(s) importada(s) com sucesso.
            </p>
          )}
        </Card>

        {!event && (
          <p className="text-sm text-slate-400">
            Cole o JSON do evento acima para ver o progresso e a recomendação de
            multiplicador.
          </p>
        )}

        {event && (
          <>
            <Card title={event.name}>
              <p className="text-xs text-slate-400">Tempo restante</p>
              <p className="text-lg font-semibold text-indigo-300">
                {formatCountdown(event.end_date)}
              </p>
            </Card>

            <Card title="Recomendação">
              <p className="text-xs text-slate-500">
                Fórmula reimplementada por conta própria a partir de comportamento
                observado publicamente, só para cálculo pessoal — não é código de
                terceiros.
              </p>
              {recommendation && (
                <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
                  <div>
                    <p className="text-xs text-slate-400">Valor Total</p>
                    <p className="text-lg font-semibold text-slate-200">
                      {formatNumber(recommendation.totalValue)} RLT
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Multiplicador Recomendado</p>
                    <p className="text-lg font-semibold text-indigo-300">
                      {recommendation.recommended}x
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">RLT a Comprar</p>
                    <p className="text-lg font-semibold text-slate-200">
                      {formatNumber(recommendation.rltToBuy, 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Ratio</p>
                    <p className="text-lg font-semibold text-slate-200">
                      {formatNumber(recommendation.ratio)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Nota</p>
                    <p
                      className={`text-lg font-semibold ${scoreColorClass(recommendation.score)}`}
                    >
                      {formatNumber(recommendation.score, 1)}/10
                    </p>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Recompensas">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs uppercase text-slate-400">
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
          </>
        )}
      </div>
    </div>
  )
}
