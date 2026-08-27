import type { Miner, Rack } from '../utils/calculatePower'

interface ApiResponse<T> {
  success: boolean
  data: T
}

interface PublicProfile {
  avatar_id: string
  name?: string
  registration?: string
  league?: {
    title?: { en?: string }
    main_img_url?: string
  }
}

interface PowerData {
  max_power: number
  current_power: number
  miners: number
  racks: number
  temp: number
  bonus: number
  bonus_percent: number
  games: number
}

interface RoomConfig {
  miners: Miner[]
  racks: Rack[]
  rooms: unknown
  appearance: unknown
}

export async function fetchRollerCoin(endpoint: string) {
  const response = await fetch(`${import.meta.env.VITE_PROXY_URL}/${endpoint}`)

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = body?.error ?? `${response.status} ${response.statusText}`.trim()
    throw new Error(`Falha ao buscar dados do RollerCoin: ${message}`)
  }

  return response.json()
}

export async function getPublicProfile(nickname: string): Promise<PublicProfile> {
  const result: ApiResponse<PublicProfile> = await fetchRollerCoin(
    `profile/public-user-profile-data/${nickname}`,
  )
  return result.data
}

export async function getPowerData(avatarId: string): Promise<PowerData> {
  const result: ApiResponse<PowerData> = await fetchRollerCoin(
    `profile/user-power-data/${avatarId}`,
  )
  return result.data
}

export async function getRoomConfig(avatarId: string): Promise<RoomConfig> {
  const result: ApiResponse<RoomConfig> = await fetchRollerCoin(
    `game/room-config/${avatarId}`,
  )
  return result.data
}

// INVESTIGAÇÃO (Prompt 67): powerData (profile/user-power-data) e
// roomConfig (game/room-config) são buscados em paralelo aqui, no MESMO
// instante -- mas são DOIS sistemas de backend diferentes da RollerCoin,
// sem garantia de consistência entre si. room-config reflete o estado
// LIVE da sala (confirmado: refletiu uma troca real segundos depois de
// aplicada no jogo); user-power-data (current_power/temp/bonus_percent/
// max_power, usado pelo Dashboard nos cards "Poder Total"/"Max Power" e
// pelo painel esquerdo do Simulador) parece ser um snapshot com cache
// próprio do lado do RollerCoin, que pode ficar minutos atrasado em
// relação a uma mudança recente na sala -- SEM campo de timestamp na
// resposta que confirme o atraso diretamente, mas consistente com o
// comportamento já documentado na referência ROOMS. Não é bug nosso -- é
// característica do jogo, não corrigível do lado do cliente (só esperar o
// RollerCoin recalcular).
//
// Prompt 68: "Poder Sem Temporário" (Dashboard) e o total do
// Auto-Otimizador (Simulador) NÃO usam mais current_power/temp -- os dois
// recalculam localmente a partir do MESMO roomConfig (miners+racks+bônus
// dedup+set, sem games, ver calculateRoomPower/sumRoomBonusPercentWithSets
// e Dashboard.tsx), então ficam sincronizados por construção, sem
// depender do cache de user-power-data. O atraso descrito acima agora só
// afeta comparações que envolvam current_power/max_power diretamente
// (ex: "Poder Total" ou "Max Power" do Dashboard vs a sala ao vivo).
export async function getPlayerPower(nickname: string) {
  const profile = await getPublicProfile(nickname)
  const [powerData, roomConfig] = await Promise.all([
    getPowerData(profile.avatar_id),
    getRoomConfig(profile.avatar_id),
  ])

  return {
    name: profile.name ?? nickname,
    registration: profile.registration,
    liga: profile.league?.title?.en,
    currentLeagueImageUrl: profile.league?.main_img_url ?? null,
    avatar: profile.avatar_id,
    max_power: powerData.max_power,
    current_power: powerData.current_power,
    miners: powerData.miners,
    racks: powerData.racks,
    temp: powerData.temp,
    bonus: powerData.bonus,
    bonus_percent: powerData.bonus_percent,
    games: powerData.games,
    roomConfig,
  }
}
