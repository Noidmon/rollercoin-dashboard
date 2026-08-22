import { useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { getLeagueInfo, getNextLeagueImageUrl, proxyImageUrl } from '../data/leagues'
import { formatPower } from '../utils/formatPower'
import Card from '../components/Card'

function LeagueBadge({
  src,
  size,
  active,
}: {
  src: string | null | undefined
  size: number
  active: boolean
}) {
  const [hidden, setHidden] = useState(false)

  if (!src || hidden) return null

  return (
    <img
      src={src}
      onError={() => setHidden(true)}
      width={size}
      height={size}
      className={`rounded-full border bg-slate-800 object-contain p-1 ${
        active ? 'border-indigo-400' : 'border-slate-700 opacity-70'
      }`}
    />
  )
}

function formatRegistrationDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

export default function Dashboard() {
  const { playerData } = usePlayer()

  if (!playerData) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="mt-4 text-sm text-slate-400">
          Digite um nickname no menu lateral para começar.
        </p>
      </div>
    )
  }

  const { currentLeague, nextLeague, powerNeeded, progressPercent } = getLeagueInfo(
    playerData.max_power,
  )
  const currentLeagueImageUrl = proxyImageUrl(playerData.currentLeagueImageUrl)
  const nextLeagueImageUrl = proxyImageUrl(
    getNextLeagueImageUrl(playerData.currentLeagueImageUrl),
  )
  const powerWithoutTemp = playerData.current_power - playerData.temp

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-white">{playerData.name}</h1>
        {playerData.registration && (
          <div className="text-right">
            <p className="text-xs text-slate-500">Jogador desde</p>
            <p className="text-sm text-slate-300">
              {formatRegistrationDate(playerData.registration)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-8">
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
            Resumo de Poder
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card title="Poder Total (com bônus)">
              <p className="text-2xl font-bold text-emerald-400">
                {formatPower(playerData.current_power)}
              </p>
            </Card>
            <Card title="Poder Sem Temporário">
              <p className="text-2xl font-bold text-white">
                {formatPower(powerWithoutTemp)}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Total menos o poder temporário (que expira). Não é o valor real que
                conta para a liga.
              </p>
            </Card>
            <Card title="Max Power (marca d'água)">
              <p className="text-2xl font-bold text-white">
                {formatPower(playerData.max_power)}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Segundo terceiros, este valor é um recorde histórico que só sobe — pode
                não refletir seu poder permanente atual com precisão.
              </p>
            </Card>
          </div>
        </section>

        <section>
          <Card title="Poder Permanente">
            <p className="text-4xl font-bold text-emerald-400">
              {formatPower(playerData.max_power)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              (conta para a liga, sem bônus temporário)
            </p>

            <div className="mt-6">
              <p className="text-sm text-slate-300">
                {nextLeague
                  ? `Só faltam ${formatPower(powerNeeded)} para a próxima liga!`
                  : 'Liga máxima atingida!'}
              </p>

              <div className="mt-3 flex items-center gap-5">
                <LeagueBadge src={currentLeagueImageUrl} size={72} active />

                <div className="flex-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-slate-400">
                    <span>{formatPower(playerData.max_power)}</span>
                    <span>
                      {formatPower(nextLeague ? nextLeague.min : currentLeague.min)}
                    </span>
                  </div>
                </div>

                {nextLeague && (
                  <LeagueBadge src={nextLeagueImageUrl} size={54} active={false} />
                )}
              </div>
            </div>
          </Card>
        </section>

        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
            Detalhamento dos Componentes
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Card title="Miners">
              <p className="text-lg text-slate-200">{formatPower(playerData.miners)}</p>
            </Card>
            <Card title="Bônus">
              <p className="text-lg text-slate-200">
                {formatPower(playerData.bonus)} (
                {(playerData.bonus_percent / 100).toFixed(2)}%)
              </p>
            </Card>
            <Card title="Racks">
              <p className="text-lg text-slate-200">{formatPower(playerData.racks)}</p>
            </Card>
            <Card title="Temporário">
              <p className="text-lg text-slate-200">{formatPower(playerData.temp)}</p>
            </Card>
            <Card title="Poder de Jogos">
              <p className="text-lg text-slate-200">{formatPower(playerData.games)}</p>
            </Card>
          </div>
        </section>
      </div>
    </div>
  )
}
