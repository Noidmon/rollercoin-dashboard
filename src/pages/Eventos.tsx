import { useState } from 'react'
import { parseEventText, type ParsedEvent } from '../utils/parseEventData'
import Card from '../components/Card'

const STORAGE_KEY = 'rollercoin-dashboard:event'

function loadStoredEvent(): ParsedEvent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ParsedEvent) : null
  } catch {
    return null
  }
}

export default function Eventos() {
  const [rawInput, setRawInput] = useState('')
  const [event, setEvent] = useState<ParsedEvent | null>(loadStoredEvent)
  const [parseError, setParseError] = useState<string | null>(null)

  function handleImport() {
    setParseError(null)

    const parsed = parseEventText(rawInput)
    if (!parsed.rewards.length) {
      setParseError('Não consegui reconhecer nenhuma recompensa nesse texto.')
      return
    }

    setEvent(parsed)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
  }

  const progressPercent =
    event?.currentPoints != null && event?.pointsNeededForLevel
      ? Math.min((event.currentPoints / event.pointsNeededForLevel) * 100, 100)
      : null

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Eventos</h1>

      <div className="mt-4 space-y-4">
        <Card title="Importar Evento">
          <p className="text-xs text-slate-500">
            Cole aqui o texto da tela de evento (selecione e copie a tela inteira do
            jogo).
          </p>
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            rows={6}
            placeholder="Cole aqui o texto da tela de evento..."
            className="mt-3 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleImport}
            className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Importar evento
          </button>
          {parseError && <p className="mt-2 text-sm text-red-400">{parseError}</p>}
          {event && !parseError && (
            <p className="mt-2 text-sm text-emerald-400">
              {event.rewards.length} nível(is) importado(s) com sucesso.
            </p>
          )}
        </Card>

        {!event && (
          <p className="text-sm text-slate-400">
            Cole o texto da tela de evento acima para ver seu progresso e recompensas.
          </p>
        )}

        {event && (
          <>
            <Card title={event.eventName ?? 'Evento'}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400">Tempo restante</p>
                  <p className="text-lg font-semibold text-indigo-300">
                    {event.timeLeft ?? '--'}
                  </p>
                </div>
                {event.mainReward && (
                  <div>
                    <p className="text-xs text-slate-400">Recompensa principal</p>
                    <p className="text-lg font-semibold text-emerald-400">
                      {event.mainReward}
                    </p>
                  </div>
                )}
              </div>

              {progressPercent !== null && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Nível {event.currentLevel ?? '--'}</span>
                    <span>
                      {event.currentPoints?.toLocaleString('en-US')} /{' '}
                      {event.pointsNeededForLevel?.toLocaleString('en-US')} pontos
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </Card>

            <Card title="Recompensas">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs uppercase text-slate-400">
                      <th className="py-2 pr-3 font-medium">Nível</th>
                      <th className="py-2 pr-3 font-medium">Total</th>
                      <th className="py-2 pr-3 font-medium">Pontos</th>
                      <th className="py-2 pr-3 font-medium">Recompensa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {event.rewards.map((reward) => (
                      <tr
                        key={reward.level}
                        className={`border-b border-slate-800/60 ${
                          reward.level === event.currentLevel
                            ? 'bg-indigo-500/10 font-semibold text-white'
                            : ''
                        }`}
                      >
                        <td className="py-2 pr-3 text-slate-300">{reward.level}</td>
                        <td className="py-2 pr-3 text-slate-300">
                          {reward.totalPoints.toLocaleString('en-US')}
                        </td>
                        <td className="py-2 pr-3 text-slate-300">
                          {reward.pointsForLevel.toLocaleString('en-US')}
                        </td>
                        <td className="py-2 pr-3 text-slate-200">
                          {reward.rewardName} — {reward.rewardValue}
                        </td>
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
