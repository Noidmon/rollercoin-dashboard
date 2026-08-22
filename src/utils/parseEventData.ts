export type RewardType = 'money' | 'miner' | 'power_temp' | 'other'

export interface EventReward {
  level: number
  totalPoints: number
  pointsForLevel: number
  rewardName: string
  rewardValue: string
  rewardType: RewardType
  amount?: number
  currency?: 'RST' | 'RLT'
  powerGhS?: number
}

export interface ParsedEvent {
  eventName: string | null
  timeLeft: string | null
  currentLevel: number | null
  currentPoints: number | null
  pointsNeededForLevel: number | null
  mainReward: string | null
  maxMultiplier: number | null
  rewards: EventReward[]
}

const NOISE_EXACT = new Set(
  [
    'exchange',
    'quests',
    'all rewards',
    'go to inventory',
    'all rewards have been claimed.',
    'info icon',
  ].map((s) => s.toLowerCase()),
)

function isNoiseLine(line: string): boolean {
  const lower = line.toLowerCase()
  if (NOISE_EXACT.has(lower)) return true
  if (lower.startsWith('lootbox')) return true
  // Moeda + percentual numa linha só (formato alternativo), ex: "TRX -30%".
  if (/^[a-z]{2,6}\s*[-+]?\d+(\.\d+)?%$/i.test(line.trim())) return true
  return false
}

// Bloco Exchange no texto real: símbolo da moeda e percentual vêm em DUAS linhas
// separadas ("TRX" / "-30%"), não numa linha só — filtra o par junto.
function isCurrencyPercentPair(line: string, nextLine: string | undefined): boolean {
  return /^[A-Z]{2,6}$/.test(line) && !!nextLine && /^[-+]?\d+(\.\d+)?%$/.test(nextLine)
}

function sanitizeLines(text: string): string[] {
  const rawLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const result: string[] = []
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    if (isNoiseLine(line)) continue
    if (isCurrencyPercentPair(line, rawLines[i + 1])) {
      i++ // pula também a linha de percentual que acompanha
      continue
    }
    result.push(line)
  }
  return result
}

function toNumber(raw: string): number {
  return Number(raw.replace(/\./g, '').replace(/,/g, ''))
}

const POINTS_LINE = /^([\d.,]+)\s*\/\s*([\d.,]+)\s*Points$/i
const REWARD_IMG_LINE = /^(?:\d+)?reward img$/i
const MAX_MULTIPLIER_LINE = /^max:{1,2}\s*x?(\d+)$/i
const MONEY_VALUE = /^([\d.,]+)\s*(RST|RLT)$/i
const POWER_TEMP_VALUE = /^(.*Gh\/s)\s*\((\d+)d\)$/i
const POWER_BONUS_VALUE = /^(.*Gh\/s)([\d.,]+)%?$/

// Reconstrói "220.000 Gh/s0" -> "220.000 Gh/s (+0%)"; texto livre ("Battery x3")
// e "Gh/s (Xd)" passam direto, sem alteração.
function formatRewardValue(raw: string): string {
  const match = raw.trim().match(POWER_BONUS_VALUE)
  if (!match) return raw.trim()

  const power = match[1].trim()
  const bonus = match[2]
  return `${power} (+${bonus}%)`
}

function extractPowerGhS(power: string): number {
  return toNumber(power.replace(/Gh\/s/i, '').trim())
}

interface RewardClassification {
  rewardType: RewardType
  amount?: number
  currency?: 'RST' | 'RLT'
  powerGhS?: number
}

function classifyReward(raw: string): RewardClassification {
  const trimmed = raw.trim()

  const moneyMatch = trimmed.match(MONEY_VALUE)
  if (moneyMatch) {
    return {
      rewardType: 'money',
      amount: toNumber(moneyMatch[1]),
      currency: moneyMatch[2].toUpperCase() as 'RST' | 'RLT',
    }
  }

  const tempMatch = trimmed.match(POWER_TEMP_VALUE)
  if (tempMatch) {
    return { rewardType: 'power_temp', powerGhS: extractPowerGhS(tempMatch[1]) }
  }

  const minerMatch = trimmed.match(POWER_BONUS_VALUE)
  if (minerMatch) {
    return { rewardType: 'miner', powerGhS: extractPowerGhS(minerMatch[1]) }
  }

  return { rewardType: 'other' }
}

// Pontos reais (total acumulado / necessário naquele nível) por evento conhecido.
// O texto colado do jogo não traz essa informação junto de cada recompensa — só
// o "X / Y Points" do nível atual. Isso é um mapa fixo por enquanto (conhecida
// limitação: não generaliza pra eventos ainda não catalogados aqui).
const KNOWN_EVENT_POINTS: Record<string, Record<number, { totalPoints: number; pointsForLevel: number }>> = {
  'Bronze III Progression': {
    1: { totalPoints: 500, pointsForLevel: 500 },
    2: { totalPoints: 1500, pointsForLevel: 1000 },
    3: { totalPoints: 2000, pointsForLevel: 500 },
    4: { totalPoints: 3500, pointsForLevel: 1500 },
    5: { totalPoints: 5500, pointsForLevel: 2000 },
    6: { totalPoints: 8500, pointsForLevel: 3000 },
    7: { totalPoints: 9000, pointsForLevel: 500 },
    8: { totalPoints: 14000, pointsForLevel: 5000 },
    9: { totalPoints: 18000, pointsForLevel: 4000 },
    10: { totalPoints: 30000, pointsForLevel: 12000 },
    11: { totalPoints: 35000, pointsForLevel: 5000 },
    12: { totalPoints: 45000, pointsForLevel: 10000 },
    13: { totalPoints: 65000, pointsForLevel: 20000 },
    14: { totalPoints: 90000, pointsForLevel: 25000 },
    15: { totalPoints: 105000, pointsForLevel: 15000 },
    16: { totalPoints: 175000, pointsForLevel: 70000 },
    17: { totalPoints: 200000, pointsForLevel: 25000 },
    18: { totalPoints: 300000, pointsForLevel: 100000 },
    19: { totalPoints: 500000, pointsForLevel: 200000 },
    20: { totalPoints: 1000000, pointsForLevel: 500000 },
  },
}

export function parseEventText(text: string): ParsedEvent {
  const lines = sanitizeLines(text)

  const mainRewardLabelIndex = lines.findIndex((line) => /main reward/i.test(line))

  // O nome do evento vem depois do bloco "Left time: <valor>" e antes de
  // "main reward" — não é a primeira linha do texto (essa é "Left time:").
  const eventName =
    mainRewardLabelIndex > 0 ? lines[mainRewardLabelIndex - 1] : (lines[0] ?? null)

  const leftTimeIndex = lines.findIndex((line) => /^left time:/i.test(line))
  let timeLeft: string | null = null
  if (leftTimeIndex !== -1) {
    const sameLineValue = lines[leftTimeIndex].replace(/^left time:\s*/i, '').trim()
    timeLeft = sameLineValue || lines[leftTimeIndex + 1] || null
  }

  const maxMultiplierIndex = lines.findIndex((line) => MAX_MULTIPLIER_LINE.test(line))
  const maxMultiplier =
    maxMultiplierIndex !== -1
      ? Number(lines[maxMultiplierIndex].match(MAX_MULTIPLIER_LINE)![1])
      : null

  const pointsIndex = lines.findIndex((line) => POINTS_LINE.test(line))
  let currentLevel: number | null = null
  let currentPoints: number | null = null
  let pointsNeededForLevel: number | null = null
  if (pointsIndex !== -1) {
    const match = lines[pointsIndex].match(POINTS_LINE)!
    currentPoints = toNumber(match[1])
    pointsNeededForLevel = toNumber(match[2])

    const levelLine = lines[pointsIndex - 1]
    if (levelLine && /^\d+$/.test(levelLine)) {
      currentLevel = Number(levelLine)
    }
  }

  let mainReward: string | null = null
  if (mainRewardLabelIndex !== -1) {
    let i = mainRewardLabelIndex + 1
    while (i < lines.length && (/^\d+$/.test(lines[i]) || REWARD_IMG_LINE.test(lines[i]))) {
      i++
    }
    mainReward = i < lines.length ? formatRewardValue(lines[i]) : null
  }

  const knownPoints = eventName ? KNOWN_EVENT_POINTS[eventName] : undefined

  const rewards: EventReward[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!/^\d+$/.test(lines[i])) continue

    const level = Number(lines[i])
    if (level < 1 || level > 999) continue

    const imgLine = lines[i + 1]
    if (!imgLine || !REWARD_IMG_LINE.test(imgLine)) continue

    const rewardName = lines[i + 2]
    const rawValue = lines[i + 3]
    if (!rewardName || !rawValue) continue

    const classification = classifyReward(rawValue)
    const knownForLevel = knownPoints?.[level]

    rewards.push({
      level,
      totalPoints:
        knownForLevel?.totalPoints ??
        (pointsNeededForLevel !== null ? level * pointsNeededForLevel : 0),
      pointsForLevel: knownForLevel?.pointsForLevel ?? (pointsNeededForLevel ?? 0),
      rewardName,
      rewardValue: formatRewardValue(rawValue),
      ...classification,
    })

    i += 3
  }

  return {
    eventName,
    timeLeft,
    currentLevel,
    currentPoints,
    pointsNeededForLevel,
    mainReward,
    maxMultiplier,
    rewards,
  }
}
