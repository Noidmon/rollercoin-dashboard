export interface EventReward {
  reward_id: string
  required_level: number
  required_xp: number // total acumulado até este nível
  level_xp: number // pontos necessários SÓ deste nível
  reference_type: 'special' | 'miner' | 'item' | 'rack' | 'merge'
  name: string
  image_path: string
  value_text: string
  sellable: boolean | null
  miner_slug: string | null
}

export interface EventTask {
  type: 'game_level' | 'spend_rlt' | 'marketplace'
  xp_reward: number
  amount: number
  title: string
}

export interface EventData {
  external_event_id: string
  name: string
  slug: string
  event_type: string
  start_date: string
  end_date: string
  multiplier_exchange_rlt: string // ex: "1.0000" -- ESSE é o multiplicador base, direto do JSON
  multiplier_ttl_ms: number // duração do multiplicador em ms (172800000 = 48h)
  default_discount_percent: number | null
  cover_image_path: string | null
  rewards: EventReward[]
  tasks: EventTask[]
  // reward_summary é dado PESSOAL do jogador que gerou esse JSON -- ignore esse campo inteiro, nunca usar/salvar
}
