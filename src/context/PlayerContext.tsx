import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { getPlayerPower } from '../services/api'

type PlayerData = Awaited<ReturnType<typeof getPlayerPower>>

const STORAGE_KEY = 'rollercoin-dashboard:nickname'

interface PlayerContextValue {
  nickname: string
  setNickname: (nickname: string) => void
  playerData: PlayerData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [nickname, setNickname] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? '',
  )
  const [playerData, setPlayerData] = useState<PlayerData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, nickname)
  }, [nickname])

  const refetch = useCallback(async () => {
    if (!nickname.trim()) return

    setLoading(true)
    setError(null)

    try {
      const result = await getPlayerPower(nickname.trim())
      setPlayerData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [nickname])

  useEffect(() => {
    refetch()
  }, [])

  return (
    <PlayerContext.Provider
      value={{ nickname, setNickname, playerData, loading, error, refetch }}
    >
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (!context) {
    throw new Error('usePlayer deve ser usado dentro de um PlayerProvider')
  }
  return context
}
