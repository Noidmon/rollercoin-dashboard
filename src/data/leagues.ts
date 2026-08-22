export interface League {
  name: string
  min: number
}

export const LEAGUES: League[] = [
  { name: 'Bronze I', min: 0 },
  { name: 'Bronze II', min: 25_000_000 },
  { name: 'Bronze III', min: 50_000_000 },
  { name: 'Silver I', min: 100_000_000 },
  { name: 'Silver II', min: 150_000_000 },
  { name: 'Silver III', min: 250_000_000 },
  { name: 'Gold I', min: 650_000_000 },
  { name: 'Gold II', min: 1_500_000_000 },
  { name: 'Gold III', min: 3_500_000_000 },
  { name: 'Platinum I', min: 16_000_000_000 },
  { name: 'Platinum II', min: 50_000_000_000 },
  { name: 'Platinum III', min: 100_000_000_000 },
  { name: 'Diamond I', min: 200_000_000_000 },
  { name: 'Diamond II', min: 375_000_000_000 },
  { name: 'Diamond III', min: 650_000_000_000 },
  { name: 'Titan I', min: 1_150_000_000_000 },
  { name: 'Titan II', min: 2_160_000_000_000 },
  { name: 'Titan III', min: 4_000_000_000_000 },
  { name: 'Emerald I', min: 13_000_000_000_000 },
  { name: 'Emerald II', min: 25_000_000_000_000 },
  { name: 'Emerald III', min: 70_000_000_000_000 },
  { name: 'Legend', min: 1_000_000_000_000_000 },
]

export interface LeagueInfo {
  currentLeague: League
  nextLeague: League | null
  powerNeeded: number
  progressPercent: number
}

export function getLeagueInfo(maxPowerGhs: number): LeagueInfo {
  let currentIndex = 0
  for (let i = 0; i < LEAGUES.length; i++) {
    if (LEAGUES[i].min <= maxPowerGhs) {
      currentIndex = i
    } else {
      break
    }
  }

  const currentLeague = LEAGUES[currentIndex]
  const nextLeague = LEAGUES[currentIndex + 1] ?? null

  if (!nextLeague) {
    return { currentLeague, nextLeague: null, powerNeeded: 0, progressPercent: 0 }
  }

  const powerNeeded = nextLeague.min - maxPowerGhs
  const progressPercent =
    ((maxPowerGhs - currentLeague.min) / (nextLeague.min - currentLeague.min)) * 100

  return { currentLeague, nextLeague, powerNeeded, progressPercent }
}

function incrementHex(hex: string): string {
  const digits = hex.split('')
  let i = digits.length - 1

  while (i >= 0) {
    if (digits[i] === 'f') {
      digits[i] = '0'
      i--
    } else {
      digits[i] = (parseInt(digits[i], 16) + 1).toString(16)
      break
    }
  }

  return digits.join('')
}

export function getNextLeagueImageUrl(
  currentImageUrl: string | null | undefined,
): string | null {
  if (!currentImageUrl) return null

  const match = currentImageUrl.match(/([0-9a-fA-F]+)\.png$/)
  if (!match) return null

  const currentId = match[1]
  const nextId = incrementHex(currentId)

  return currentImageUrl.replace(`${currentId}.png`, `${nextId}.png`)
}

export function proxyImageUrl(originalUrl: string | null | undefined): string | null {
  if (!originalUrl) return null

  const caminho = originalUrl.split('/static/')[1]
  if (!caminho) return null

  return `${import.meta.env.VITE_PROXY_URL}/${caminho}`
}
