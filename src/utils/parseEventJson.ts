import type { EventData } from '../types/event'

const REQUIRED_FIELDS = ['name', 'rewards', 'tasks', 'multiplier_exchange_rlt'] as const

export function parseEventJson(raw: string): EventData {
  const parsed = JSON.parse(raw)

  for (const field of REQUIRED_FIELDS) {
    if (!(field in parsed)) {
      throw new Error(`JSON não parece ser de um evento válido, falta o campo "${field}".`)
    }
  }

  return parsed as EventData
}

export function getRewardImageUrl(imagePath: string): string {
  return `https://api.minaryganar.com/assets/${imagePath}`
}
