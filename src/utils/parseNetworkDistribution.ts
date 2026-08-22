export interface NetworkCoinData {
  symbol: string
  name: string
  networkPower: number
  rewardPerBlock: number
  blockTimeSeconds: number
}

function extractItemsArray(json: unknown): unknown[] {
  if (Array.isArray(json)) return json

  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>

    for (const key of ['data', 'result', 'coins', 'currencies', 'list', 'items', 'distribution']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[]
    }

    const values = Object.values(obj)
    if (values.length && values.every((v) => typeof v === 'object' && v !== null)) {
      return values
    }
  }

  return []
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim()) return value.trim().toUpperCase()
  }
  return null
}

function firstNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }
  return null
}

export function parseNetworkDistribution(raw: string): NetworkCoinData[] {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('JSON inválido — verifique se colou o conteúdo completo da resposta.')
  }

  const items = extractItemsArray(json)

  const parsed: NetworkCoinData[] = []

  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue
    const obj = item as Record<string, unknown>

    const symbol = firstString(obj, ['symbol', 'currency', 'coin', 'ticker', 'code', 'name'])
    const networkPower = firstNumber(obj, [
      'network_power',
      'networkPower',
      'total_power',
      'totalPower',
      'pool_power',
      'poolPower',
      'power',
    ])
    const rewardPerBlock = firstNumber(obj, [
      'reward_per_block',
      'rewardPerBlock',
      'block_reward',
      'blockReward',
      'reward',
    ])
    const blockTimeSeconds = firstNumber(obj, [
      'block_time',
      'blockTime',
      'avg_block_time',
      'avgBlockTime',
      'block_time_seconds',
    ])

    if (symbol === null || networkPower === null || rewardPerBlock === null || blockTimeSeconds === null) {
      continue
    }

    parsed.push({
      symbol,
      name: firstString(obj, ['full_name', 'fullName', 'name']) ?? symbol,
      networkPower,
      rewardPerBlock,
      blockTimeSeconds,
    })
  }

  return parsed
}

export interface NetworkTextCoinData {
  symbol: string
  networkPowerGhs: number | null
  activeUsers: number | null
  rewardPerBlock: number | null
  blockTimeSeconds: number | null
}

const POWER_UNIT_TO_GHS: Record<string, number> = {
  Gh: 1,
  Th: 1_000,
  Ph: 1_000_000,
  Eh: 1_000_000_000,
  Zh: 1_000_000_000_000,
  Yh: 1_000_000_000_000_000,
}

const IGNORED_TEXT_LINES = new Set(['game currencies', 'crypto currencies'])

// Remove NBSP e caracteres de largura zero que .trim() sozinho não pega (comuns em
// texto copiado de páginas web), antes de decidir se uma linha está vazia ou não.
const INVISIBLE_CHARS = /[ ​‌‍﻿]/g

function sanitizeLine(line: string): string {
  return line.replace(INVISIBLE_CHARS, '').trim()
}

function parsePowerToGhs(value: string): number | null {
  const match = value.trim().match(/^([\d.,]+)\s*([A-Za-z]+)\/s$/)
  if (!match) return null

  const amount = Number(match[1].replace(/,/g, ''))
  const scale = POWER_UNIT_TO_GHS[match[2]]
  if (!Number.isFinite(amount) || scale === undefined) return null

  return amount * scale
}

function parseRewardPerBlockText(value: string): number | null {
  const match = value.trim().match(/^([\d.,]+)/)
  if (!match) return null

  const amount = Number(match[1].replace(/,/g, ''))
  return Number.isFinite(amount) ? amount : null
}

function parseBlockTimeToSeconds(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})$/)
  if (!match) return null

  const totalSeconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
  return totalSeconds > 0 ? totalSeconds : null
}

function parseBlockTimeIfValid(value: string): number | null {
  return /^\d{1,2}:\d{2}:\d{2}$/.test(value.trim()) ? parseBlockTimeToSeconds(value) : null
}

function parseActiveUsers(value: string): number | null {
  const amount = Number(value.trim().replace(/,/g, ''))
  return Number.isFinite(amount) ? amount : null
}

// Símbolos de moeda são linhas inteiramente maiúsculas de 2-6 letras (RST, BTC, USDT...).
// Isso naturalmente exclui a linha de percentual ("1%") e variações minúsculas ("rst").
const SYMBOL_LINE = /^[A-Z]{2,6}$/
const SYMBOL_BACKWARD_WINDOW = 6

function findSymbolBackward(lines: string[], fromIndex: number): string | null {
  const start = Math.max(0, fromIndex - SYMBOL_BACKWARD_WINDOW)
  for (let i = fromIndex; i >= start; i--) {
    if (SYMBOL_LINE.test(lines[i])) return lines[i]
  }
  return null
}

// Procura a label (case-insensitive) numa janela adiante de `powerIndex` e retorna o
// valor parseado da linha seguinte a ela. Retorna null se a label não aparecer na
// janela, ou se não houver linha de valor depois dela (ex: texto colado truncado).
function findValueAfterLabel<T>(
  lines: string[],
  powerIndex: number,
  label: string,
  window: number,
  parse: (raw: string) => T | null,
): T | null {
  const end = Math.min(lines.length, powerIndex + window + 1)
  for (let i = powerIndex + 1; i < end; i++) {
    if (lines[i].toLowerCase() === label) {
      return i + 1 < lines.length ? parse(lines[i + 1]) : null
    }
  }
  return null
}

export function parseNetworkDistributionText(text: string): NetworkTextCoinData[] {
  const lines = text
    .split('\n')
    .map(sanitizeLine)
    .filter((line) => line.length > 0 && !IGNORED_TEXT_LINES.has(line.toLowerCase()))

  const coins: NetworkTextCoinData[] = []
  const seenSymbols = new Set<string>()

  for (let p = 0; p < lines.length; p++) {
    if (lines[p].toLowerCase() !== 'power') continue

    const symbol = findSymbolBackward(lines, p - 1)
    if (!symbol || seenSymbols.has(symbol)) continue
    seenSymbols.add(symbol)

    const networkPowerGhs = p + 1 < lines.length ? parsePowerToGhs(lines[p + 1]) : null
    const activeUsers = findValueAfterLabel(lines, p, 'active users', 5, parseActiveUsers)
    const rewardPerBlock = findValueAfterLabel(lines, p, 'per block', 8, parseRewardPerBlockText)
    const blockTimeSeconds = findValueAfterLabel(lines, p, 'block time', 10, parseBlockTimeIfValid)

    coins.push({ symbol, networkPowerGhs, activeUsers, rewardPerBlock, blockTimeSeconds })
  }

  return coins
}
