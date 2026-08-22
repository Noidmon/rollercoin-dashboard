import { useEffect, useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { getCryptoPrices, COIN_SYMBOL_TO_COINGECKO_ID } from '../services/prices'
import {
  parseNetworkDistribution,
  parseNetworkDistributionText,
} from '../utils/parseNetworkDistribution'
import { calculateCoinEarnings, type CoinNetworkData } from '../utils/calculateEarnings'
import { isWithdrawable } from '../data/withdrawable'
import Card from '../components/Card'

const NO_MARKET_PRICE_SYMBOLS = ['RLT', 'RST', 'HMT']
const GHS_PER_EHS = 1_000_000_000

type SortDirection = 'asc' | 'desc'
type SortColumn = 'dailyGainUSD' | 'weeklyGainUSD' | 'monthlyGainUSD'

function formatCoinAmount(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 8 })
}

export default function Calculadora() {
  const { playerData } = usePlayer()

  const [prices, setPrices] = useState<Record<string, number | null>>({})
  const [pricesLoading, setPricesLoading] = useState(true)
  const [pricesError, setPricesError] = useState<string | null>(null)

  const [rawInput, setRawInput] = useState('')
  const [networkData, setNetworkData] = useState<CoinNetworkData[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const [sortColumn, setSortColumn] = useState<SortColumn>('dailyGainUSD')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const [customPowerEhs, setCustomPowerEhs] = useState<number | null>(null)

  useEffect(() => {
    getCryptoPrices(Object.values(COIN_SYMBOL_TO_COINGECKO_ID))
      .then(setPrices)
      .catch((err) => setPricesError(err instanceof Error ? err.message : String(err)))
      .finally(() => setPricesLoading(false))
  }, [])

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

  const rows =
    networkData && playerData && customPowerEhs !== null
      ? networkData
          .map((coin) =>
            calculateCoinEarnings(coin, customPowerEhs * GHS_PER_EHS, priceFor(coin.symbol)),
          )
          .sort((a, b) => {
            const av = a[sortColumn] ?? -Infinity
            const bv = b[sortColumn] ?? -Infinity
            return sortDirection === 'desc' ? bv - av : av - bv
          })
      : []

  function handleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Calculadora</h1>

      <div className="mt-4 space-y-4">
        <Card title="Preços de Cripto (USD)">
          {pricesLoading && <p className="text-sm text-slate-400">Carregando preços...</p>}
          {pricesError && <p className="text-sm text-red-400">Erro: {pricesError}</p>}
          {!pricesLoading && !pricesError && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {Object.keys(COIN_SYMBOL_TO_COINGECKO_ID).map((symbol) => {
                const price = priceFor(symbol)
                return (
                  <div key={symbol}>
                    <p className="text-xs text-slate-400">{symbol}</p>
                    <p className="text-sm text-slate-200">
                      {price !== null ? `$${price.toLocaleString('en-US')}` : '--'}
                    </p>
                  </div>
                )
              })}
              {NO_MARKET_PRICE_SYMBOLS.map((symbol) => (
                <div key={symbol}>
                  <p className="text-xs text-slate-400">{symbol}</p>
                  <p className="text-sm text-slate-500">--</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {playerData && (
          <Card title="Seu Poder (EH/s)">
            <div className="flex flex-wrap items-end gap-3">
              <input
                type="number"
                value={customPowerEhs ?? 0}
                onChange={(e) => setCustomPowerEhs(Number(e.target.value))}
                className="w-40 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => setCustomPowerEhs(playerData.current_power / GHS_PER_EHS)}
                className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Resetar para meu poder atual
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Poder atual (com bônus temporário) — pode cair quando o bônus expirar. Edite
              para testar "e se eu tivesse X de poder?".
            </p>
          </Card>
        )}

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

        {!playerData && (
          <p className="text-sm text-slate-400">
            Digite um nickname no menu lateral para calcular seus ganhos estimados.
          </p>
        )}

        {playerData && !networkData && (
          <p className="text-sm text-slate-400">
            Cole o JSON de distribuição da rede acima para calcular seus ganhos estimados
            por moeda.
          </p>
        )}

        {playerData && networkData && (
          <Card title="Ganhos Estimados">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase text-slate-400">
                    <th className="py-2 pr-3 font-medium">Moeda</th>
                    <th className="py-2 pr-3 font-medium">Preço USD</th>
                    <th className="py-2 pr-3 font-medium">Poder da Rede</th>
                    <th className="py-2 pr-3 font-medium">Sua Fatia/Bloco</th>
                    <th className="py-2 pr-3 font-medium">Blocos/dia</th>
                    <th className="py-2 pr-3 font-medium">Ganho Diário</th>
                    <th
                      className="cursor-pointer py-2 pr-3 font-medium select-none"
                      onClick={() => handleSort('dailyGainUSD')}
                    >
                      Ganho Diário (USD){' '}
                      {sortColumn === 'dailyGainUSD' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th
                      className="cursor-pointer py-2 pr-3 font-medium select-none"
                      onClick={() => handleSort('weeklyGainUSD')}
                    >
                      Ganho Semanal (USD){' '}
                      {sortColumn === 'weeklyGainUSD' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th
                      className="cursor-pointer py-2 pr-3 font-medium select-none"
                      onClick={() => handleSort('monthlyGainUSD')}
                    >
                      Ganho Mensal (USD){' '}
                      {sortColumn === 'monthlyGainUSD' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.symbol} className="border-b border-slate-800/60">
                      <td className="py-2 pr-3 text-slate-300">
                        {row.name}
                        {!isWithdrawable(row.symbol) && (
                          <span className="ml-1 text-xs text-slate-500" title="Não sacável">
                            *
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {row.priceUSD !== null
                          ? `$${row.priceUSD.toLocaleString('en-US')}`
                          : '--'}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {row.networkPower !== null
                          ? formatCoinAmount(row.networkPower)
                          : '--'}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {row.yourSharePerBlock !== null
                          ? formatCoinAmount(row.yourSharePerBlock)
                          : '--'}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {row.blocksPerDay !== null ? formatCoinAmount(row.blocksPerDay) : '--'}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {row.dailyGain !== null
                          ? `${formatCoinAmount(row.dailyGain)} ${row.symbol}`
                          : '--'}
                      </td>
                      <td className="py-2 pr-3 font-semibold text-emerald-400">
                        {row.dailyGainUSD !== null ? `$${row.dailyGainUSD.toFixed(2)}` : '--'}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {row.weeklyGainUSD !== null ? `$${row.weeklyGainUSD.toFixed(2)}` : '--'}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {row.monthlyGainUSD !== null
                          ? `$${row.monthlyGainUSD.toFixed(2)}`
                          : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              * Moeda sem saque disponível no jogo.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
