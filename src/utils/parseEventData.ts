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
  // Moeda + percentual do bloco Exchange, ex: "TRX -30%", "BNB +12.5%".
  if (/^[a-z]{2,6}\s*[-+]?\d+(\.\d+)?%$/i.test(line.trim())) return true
  return false
}

function sanitizeLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isNoiseLine(line))
}

function toNumber(raw: string): number {
  return Number(raw.replace(/\./g, '').replace(/,/g, ''))
}

const POINTS_LINE = /^([\d.,]+)\s*\/\s*([\d.,]+)\s*Points$/i
const REWARD_IMG_LINE = /^(?:\d+)?reward img$/i
const MONEY_VALUE = /^([\d.,]+)\s*(RST|RLT)$/i
const POWER_TEMP_VALUE = /^(.*Gh\/s)\s*\((\d+)d\)$/i
const POWER_BONUS_VALUE = /^(.*Gh\/s)([\d.,]+)%?$/

// Reconstrói "220.000 Gh/s0" -> "220.000 Gh/s (+0%)"; texto livre ("Battery x3")
// passa direto, sem alteração.
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

export function parseEventText(text: string): ParsedEvent {
  const lines = sanitizeLines(text)

  const eventName = lines[0] ?? null

  const leftTimeIndex = lines.findIndex((line) => /^left time:/i.test(line))
  let timeLeft: string | null = null
  if (leftTimeIndex !== -1) {
    const sameLineValue = lines[leftTimeIndex].replace(/^left time:\s*/i, '').trim()
    timeLeft = sameLineValue || lines[leftTimeIndex + 1] || null
  }

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

  const mainRewardLabelIndex = lines.findIndex((line) => /main reward/i.test(line))
  let mainReward: string | null = null
  if (mainRewardLabelIndex !== -1) {
    let i = mainRewardLabelIndex + 1
    while (i < lines.length && (/^\d+$/.test(lines[i]) || REWARD_IMG_LINE.test(lines[i]))) {
      i++
    }
    mainReward = i < lines.length ? formatRewardValue(lines[i]) : null
  }

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

    rewards.push({
      level,
      // O texto colado não traz pontos por nível dentro do bloco de recompensa em
      // si (só nível + badge + nome + valor) — assumimos progressão uniforme
      // usando o "pointsNeededForLevel" do cabeçalho até termos um exemplo real
      // que mostre pontos variáveis por nível.
      totalPoints: pointsNeededForLevel !== null ? level * pointsNeededForLevel : 0,
      pointsForLevel: pointsNeededForLevel ?? 0,
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
    rewards,
  }
}
