import { BLOCK_TIME_SECONDS } from '../data/blockTimes'

export interface CoinNetworkData {
  symbol: string
  name: string
  networkPower: number | null
  rewardPerBlock: number | null
}

export interface CoinEarnings extends CoinNetworkData {
  priceUSD: number | null
  yourSharePerBlock: number | null
  blocksPerDay: number | null
  dailyGain: number | null
  weeklyGain: number | null
  monthlyGain: number | null
  dailyGainUSD: number | null
  weeklyGainUSD: number | null
  monthlyGainUSD: number | null
}

// powerGhs deve estar em Gh/s (mesma unidade de current_power/max_power da API).
export function calculateCoinEarnings(
  coin: CoinNetworkData,
  powerGhs: number,
  priceUSD: number | null,
): CoinEarnings {
  const blockTimeSeconds = BLOCK_TIME_SECONDS[coin.symbol] ?? null

  const yourSharePerBlock =
    coin.networkPower !== null && coin.rewardPerBlock !== null
      ? (powerGhs / coin.networkPower) * coin.rewardPerBlock
      : null

  const blocksPerDay = blockTimeSeconds !== null ? 86400 / blockTimeSeconds : null

  const dailyGain =
    blocksPerDay !== null && yourSharePerBlock !== null
      ? yourSharePerBlock * blocksPerDay
      : null

  const weeklyGain = dailyGain !== null ? dailyGain * 7 : null
  const monthlyGain = dailyGain !== null ? dailyGain * 30 : null

  const dailyGainUSD = priceUSD !== null && dailyGain !== null ? dailyGain * priceUSD : null
  const weeklyGainUSD = dailyGainUSD !== null ? dailyGainUSD * 7 : null
  const monthlyGainUSD = dailyGainUSD !== null ? dailyGainUSD * 30 : null

  return {
    ...coin,
    priceUSD,
    yourSharePerBlock,
    blocksPerDay,
    dailyGain,
    weeklyGain,
    monthlyGain,
    dailyGainUSD,
    weeklyGainUSD,
    monthlyGainUSD,
  }
}
