import { usePlayer } from '../context/PlayerContext'
import { useNetworkData } from '../context/NetworkDataContext'
import { getLeagueInfo, getNextLeagueImageUrl, proxyImageUrl } from '../data/leagues'
import { formatPower } from '../utils/formatPower'
import { calculateCoinEarnings, type CoinEarnings } from '../utils/calculateEarnings'
import { isWithdrawable } from '../data/withdrawable'
import { COIN_SYMBOL_TO_COINGECKO_ID } from '../services/prices'
import Card from '../components/Card'
import CurrencyIcon from '../components/CurrencyIcon'
import LeagueBadge from '../components/LeagueBadge'

function formatUSD(value: number | null): string {
  return value !== null && Number.isFinite(value)
    ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '--'
}

function bestEarner(rows: CoinEarnings[], predicate: (row: CoinEarnings) => boolean) {
  return rows
    .filter(predicate)
    .filter((row) => row.dailyGainUSD !== null)
    .sort((a, b) => (b.dailyGainUSD ?? -Infinity) - (a.dailyGainUSD ?? -Infinity))[0] ?? null
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
  const { networkData, prices } = useNetworkData()

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
  // Vem direto de user-power-data (current_power/temp oficiais da API) --
  // pode divergir por alguns minutos do "Sem Temporário" recalculado
  // localmente pelo Auto-Otimizador no Simulador (esse usa room-config, que
  // reflete a sala AO VIVO) logo após uma troca real no jogo. Não é bug,
  // ver comentário em getPlayerPower (services/api.ts).
  const powerWithoutTemp = playerData.current_power - playerData.temp

  function priceFor(symbol: string): number | null {
    const coingeckoId = COIN_SYMBOL_TO_COINGECKO_ID[symbol]
    if (!coingeckoId) return null
    return prices[coingeckoId] ?? null
  }

  const earningsRows: CoinEarnings[] | null = networkData
    ? networkData.map((coin) =>
        calculateCoinEarnings(coin, playerData.current_power, priceFor(coin.symbol)),
      )
    : null

  const bestGeral = earningsRows ? bestEarner(earningsRows, () => true) : null
  const bestSacavel = earningsRows
    ? bestEarner(earningsRows, (row) => isWithdrawable(row.symbol))
    : null

  const liquidityCostPercent =
    bestGeral &&
    bestSacavel &&
    bestGeral.symbol !== bestSacavel.symbol &&
    bestGeral.dailyGainUSD !== null &&
    bestSacavel.dailyGainUSD !== null
      ? ((bestGeral.dailyGainUSD - bestSacavel.dailyGainUSD) / bestGeral.dailyGainUSD) * 100
      : null

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
                Calculado a partir da sua sala e bônus atuais (sem bônus temporário).
                Uma diferença em relação ao Max Power é esperada e pode variar.
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

        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
            Melhor Moeda
          </h2>
          <Card title="Ganho Diário Estimado">
            {!networkData && (
              <p className="text-sm text-slate-400">
                Importe os dados de rede na Calculadora primeiro para ver a melhor
                moeda.
              </p>
            )}

            {networkData && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Geral</span>
                  {bestGeral ? (
                    <span className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                      <CurrencyIcon symbol={bestGeral.symbol} />
                      {bestGeral.name}
                      <span className="text-slate-400">
                        ({formatUSD(bestGeral.dailyGainUSD)}/dia)
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm text-slate-500">--</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Sacável</span>
                  {bestSacavel ? (
                    <span className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
                      <CurrencyIcon symbol={bestSacavel.symbol} />
                      {bestSacavel.name}
                      <span className="text-slate-400">
                        ({formatUSD(bestSacavel.dailyGainUSD)}/dia)
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm text-slate-500">--</span>
                  )}
                </div>

                {liquidityCostPercent !== null && bestGeral && (
                  <p className="text-xs text-amber-400">
                    {bestGeral.symbol} paga mais mas não pode ser sacada — custa{' '}
                    {liquidityCostPercent.toFixed(1)}% em troca de liquidez.
                  </p>
                )}
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  )
}
