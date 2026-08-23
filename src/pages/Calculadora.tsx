import { useEffect, useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { useNetworkData } from '../context/NetworkDataContext'
import { COIN_SYMBOL_TO_COINGECKO_ID } from '../services/prices'
import {
  parseNetworkDistribution,
  parseNetworkDistributionText,
} from '../utils/parseNetworkDistribution'
import { calculateCoinEarnings, type CoinEarnings } from '../utils/calculateEarnings'
import { BLOCK_TIME_SECONDS } from '../data/blockTimes'
import { getLeagueInfo } from '../data/leagues'
import { isWithdrawable } from '../data/withdrawable'
import { WITHDRAWAL_MINIMUMS } from '../data/withdrawalMinimums'
import Card from '../components/Card'
import CurrencyIcon from '../components/CurrencyIcon'

const GHS_PER_EHS = 1_000_000_000

type DisplayMode = 'usd' | 'crypto'
type SortColumn = 'percentNetwork' | 'daily' | 'weekly' | 'monthly'
type SortDirection = 'asc' | 'desc'

interface CoinRow extends CoinEarnings {
  percentNetwork: number | null
}

function formatUSD(value: number | null): string {
  return value !== null && Number.isFinite(value)
    ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '--'
}

function formatCoinAmount(value: number | null): string {
  return value !== null && Number.isFinite(value)
    ? value.toLocaleString('en-US', { maximumFractionDigits: 8 })
    : '--'
}

function formatPercent(value: number | null): string {
  return value !== null && Number.isFinite(value) ? `${value.toFixed(4)}%` : '--'
}

function formatBlockTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

// Formata uma duração em dias como "X dias Y horas" -- reaproveitável em
// qualquer outro lugar do projeto que precise do mesmo formato.
function formatDaysHours(days: number): string {
  const totalHours = Math.round(days * 24)
  const wholeDays = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return `${wholeDays} dias ${hours} horas`
}

// Tempo até acumular o saque mínimo da moeda, partindo de 0, com base no
// ganho diário já calculado na tabela. null quando a moeda não é sacável ou
// quando o ganho diário é praticamente zero (divisão por zero/infinito).
function withdrawalTimeText(row: CoinRow): string {
  if (!isWithdrawable(row.symbol)) return '—'
  const minimum = WITHDRAWAL_MINIMUMS[row.symbol]
  if (minimum === undefined) return '—'
  if (row.dailyGain === null || row.dailyGain < 1e-12) return '—'
  const daysNeeded = minimum / row.dailyGain
  return formatDaysHours(daysNeeded)
}

function valueFor(row: CoinRow, column: SortColumn, mode: DisplayMode): number {
  if (column === 'percentNetwork') return row.percentNetwork ?? -Infinity
  if (mode === 'usd') {
    if (column === 'daily') return row.dailyGainUSD ?? -Infinity
    if (column === 'weekly') return row.weeklyGainUSD ?? -Infinity
    return row.monthlyGainUSD ?? -Infinity
  }
  if (column === 'daily') return row.dailyGain ?? -Infinity
  if (column === 'weekly') return row.weeklyGain ?? -Infinity
  return row.monthlyGain ?? -Infinity
}

const BLOCK_DURATIONS = Object.entries(BLOCK_TIME_SECONDS)
  .map(([symbol, seconds]) => ({ symbol, seconds }))
  .sort((a, b) => a.seconds - b.seconds)

export default function Calculadora() {
  const { playerData } = usePlayer()
  const { networkData, setNetworkData, prices, pricesLoading, pricesError } =
    useNetworkData()

  const [rawInput, setRawInput] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)

  const [customPowerEhs, setCustomPowerEhs] = useState<number | null>(null)
  const [displayMode, setDisplayMode] = useState<DisplayMode>('usd')
  const [sortColumn, setSortColumn] = useState<SortColumn>('daily')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  useEffect(() => {
    if (playerData) {
      setCustomPowerEhs(playerData.current_power / GHS_PER_EHS)
    }
  }, [playerData])

  function handleImport() {
    setParseError(null)

    const fromText = parseNetworkDistributionText(rawInput)
    if (fromText.length) {
      setNetworkData(
        fromText.map((coin) => ({
          symbol: coin.symbol,
          name: coin.symbol,
          networkPower: coin.networkPowerGhs,
          rewardPerBlock: coin.rewardPerBlock,
        })),
      )
      return
    }

    try {
      const parsed = parseNetworkDistribution(rawInput)
      if (!parsed.length) {
        setParseError(
          'Não reconheci o formato colado — nem como texto da tela de Liga, nem como JSON com os campos esperados.',
        )
        return
      }
      setNetworkData(parsed)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err))
    }
  }

  function priceFor(symbol: string): number | null {
    const coingeckoId = COIN_SYMBOL_TO_COINGECKO_ID[symbol]
    if (!coingeckoId) return null
    return prices[coingeckoId] ?? null
  }

  function handleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const customPowerGhs = customPowerEhs !== null ? customPowerEhs * GHS_PER_EHS : null

  const rows: CoinRow[] =
    networkData && customPowerGhs !== null
      ? networkData
          .map((coin) => {
            const earnings = calculateCoinEarnings(coin, customPowerGhs, priceFor(coin.symbol))
            const percentNetwork =
              coin.networkPower !== null && coin.networkPower !== 0
                ? (customPowerGhs / coin.networkPower) * 100
                : null
            return { ...earnings, percentNetwork }
          })
          .sort((a, b) => {
            const av = valueFor(a, sortColumn, displayMode)
            const bv = valueFor(b, sortColumn, displayMode)
            return sortDirection === 'desc' ? bv - av : av - bv
          })
      : []

  const leagueInfo = playerData ? getLeagueInfo(playerData.max_power) : null

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Calculadora</h1>

      <div className="mt-4 space-y-4">
        <Card title="Poder e Preferências">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Seu Poder (EH/s)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customPowerEhs ?? 0}
                  onChange={(e) => setCustomPowerEhs(Number(e.target.value))}
                  className="w-36 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {playerData && (
                  <button
                    onClick={() => setCustomPowerEhs(playerData.current_power / GHS_PER_EHS)}
                    className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                  >
                    Usar meu poder atual
                  </button>
                )}
              </div>
            </div>

            {leagueInfo && (
              <div>
                <p className="text-xs text-slate-400">Sua Liga</p>
                <p className="text-lg font-semibold text-indigo-300">
                  {leagueInfo.currentLeague.name}
                </p>
              </div>
            )}

            <div>
              <p className="mb-1 text-xs text-slate-400">Exibir em</p>
              <div className="flex overflow-hidden rounded-md border border-slate-700">
                <button
                  onClick={() => setDisplayMode('usd')}
                  className={`px-3 py-1.5 text-sm font-medium ${
                    displayMode === 'usd'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  USD
                </button>
                <button
                  onClick={() => setDisplayMode('crypto')}
                  className={`px-3 py-1.5 text-sm font-medium ${
                    displayMode === 'crypto'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Cripto
                </button>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.7fr_2.6fr_0.7fr]">
          <Card title="Duração do Bloco">
            <div className="space-y-2">
              {BLOCK_DURATIONS.map(({ symbol, seconds }) => (
                <div key={symbol} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-300">
                    <CurrencyIcon symbol={symbol} />
                    {symbol}
                  </span>
                  <span className="whitespace-nowrap text-slate-400">
                    {formatBlockTime(seconds)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Ganhos Estimados">
            {!playerData && (
              <p className="text-sm text-slate-400">
                Digite um nickname no menu lateral para calcular seus ganhos estimados.
              </p>
            )}

            {playerData && !networkData && (
              <p className="text-sm text-slate-400">
                Cole os dados de distribuição da rede abaixo para calcular seus ganhos
                estimados por moeda.
              </p>
            )}

            {playerData && networkData && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs uppercase text-slate-400">
                      <th className="py-2 pr-3 font-medium">Moeda</th>
                      <th
                        className="cursor-pointer select-none whitespace-nowrap py-2 pr-3 font-medium"
                        onClick={() => handleSort('percentNetwork')}
                      >
                        % Rede{' '}
                        {sortColumn === 'percentNetwork' &&
                          (sortDirection === 'desc' ? '↓' : '↑')}
                      </th>
                      <th
                        className="cursor-pointer select-none whitespace-nowrap py-2 pr-3 font-medium"
                        onClick={() => handleSort('daily')}
                      >
                        Diário {sortColumn === 'daily' && (sortDirection === 'desc' ? '↓' : '↑')}
                      </th>
                      <th
                        className="cursor-pointer select-none whitespace-nowrap py-2 pr-3 font-medium"
                        onClick={() => handleSort('weekly')}
                      >
                        Semanal{' '}
                        {sortColumn === 'weekly' && (sortDirection === 'desc' ? '↓' : '↑')}
                      </th>
                      <th
                        className="cursor-pointer select-none whitespace-nowrap py-2 pr-3 font-medium"
                        onClick={() => handleSort('monthly')}
                      >
                        Mensal (30d){' '}
                        {sortColumn === 'monthly' && (sortDirection === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="whitespace-nowrap py-2 pr-3 font-medium">
                        Tempo de Saque
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.symbol} className="border-b border-slate-800/60">
                        <td className="py-2 pr-3 text-slate-300">
                          <span className="flex items-center gap-2">
                            <CurrencyIcon symbol={row.symbol} />
                            {row.name}
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-slate-300">
                          {formatPercent(row.percentNetwork)}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 font-semibold text-emerald-400">
                          {displayMode === 'usd'
                            ? formatUSD(row.dailyGainUSD)
                            : `${formatCoinAmount(row.dailyGain)} ${row.symbol}`}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-slate-300">
                          {displayMode === 'usd'
                            ? formatUSD(row.weeklyGainUSD)
                            : `${formatCoinAmount(row.weeklyGain)} ${row.symbol}`}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-slate-300">
                          {displayMode === 'usd'
                            ? formatUSD(row.monthlyGainUSD)
                            : `${formatCoinAmount(row.monthlyGain)} ${row.symbol}`}
                        </td>
                        <td
                          className="whitespace-nowrap py-2 pr-3 text-slate-300"
                          title={!isWithdrawable(row.symbol) ? 'não sacável' : undefined}
                        >
                          {withdrawalTimeText(row)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Preços">
            <p className="-mt-2 mb-3 text-xs text-slate-500">via CoinGecko</p>
            <div className="space-y-2">
              {Object.keys(COIN_SYMBOL_TO_COINGECKO_ID).map((symbol) => {
                const price = priceFor(symbol)
                return (
                  <div key={symbol} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-300">
                      <CurrencyIcon symbol={symbol} />
                      {symbol}
                    </span>
                    <span className="whitespace-nowrap text-slate-400">
                      {pricesLoading ? '...' : formatUSD(price)}
                    </span>
                  </div>
                )
              })}
              {pricesError && <p className="text-xs text-red-400">Erro: {pricesError}</p>}
            </div>
          </Card>
        </div>

        <Card title="Importar Dados da Rede">
          <p className="text-xs text-slate-500">
            Mais fácil: no jogo, abra a tela "League Power Partition", selecione e copie o
            texto da tela inteira, e cole aqui — sem precisar de DevTools. Alternativa
            avançada: abra o DevTools (F12) → Network → filtre por "distribution" → clique
            na chamada → aba Response → copie e cole o JSON aqui.
          </p>
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            rows={6}
            placeholder="Cole aqui o texto da tela League Power Partition (ou o JSON da resposta)..."
            className="mt-3 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleImport}
            className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Importar dados da rede
          </button>
          {parseError && <p className="mt-2 text-sm text-red-400">{parseError}</p>}
          {networkData && !parseError && (
            <p className="mt-2 text-sm text-emerald-400">
              {networkData.length} moeda(s) importada(s) com sucesso.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
