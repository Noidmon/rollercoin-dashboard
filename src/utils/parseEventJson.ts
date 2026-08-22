import type { EventData } from '../types/event'
import { resolveAssetUrl } from './resolveAssetUrl'

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
  return resolveAssetUrl(imagePath)
}

// reward_summary é dado pessoal do jogador que gerou o JSON — nunca deve ser
// persistido. Usado antes de salvar no localStorage.
export function stripRewardSummary(raw: string): string {
  const obj = JSON.parse(raw) as Record<string, unknown>
  delete obj.reward_summary
  return JSON.stringify(obj)
}
