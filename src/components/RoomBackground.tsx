import { useEffect, useState } from 'react'

interface RoomBackgroundLayoutEntry {
  asset: string
  left: number
  top: number
  width: number
  height: number
  speed?: number
}

interface RoomBackgroundLayout {
  sala0: RoomBackgroundLayoutEntry[]
  salas1a3: RoomBackgroundLayoutEntry[]
}

// Tamanho total do canvas da sala -- vem de Ar.desktopWidth/desktopHeight
// (docs/room-layout-investigation.md), não calculado por bounding box das
// entradas (mas bate exatamente: decore10 é a entrada mais à direita/embaixo,
// right=720, bottom=449).
export const ROOM_WIDTH = 720
export const ROOM_HEIGHT = 450

interface RoomBackgroundProps {
  roomLevel: number
}

export default function RoomBackground({ roomLevel }: RoomBackgroundProps) {
  const [layout, setLayout] = useState<RoomBackgroundLayout | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/data/roomBackgroundLayout.json')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json()
      })
      .then((json: RoomBackgroundLayout) => {
        if (!cancelled) setLayout(json)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return <p className="text-sm text-red-400">Erro ao carregar fundo da sala: {error}</p>
  }

  // Sala 0 tem decoração própria (sala0); salas 1, 2 e 3 compartilham
  // exatamente a mesma decoração (salas1a3) -- confirmado no bundle real do
  // minaryganar, não são 4 composições distintas, só 2.
  const entries = layout ? (roomLevel === 0 ? layout.sala0 : layout.salas1a3) : []

  return (
    <div
      className="relative overflow-hidden rounded-md bg-[#8a7256]"
      style={{ width: ROOM_WIDTH, height: ROOM_HEIGHT }}
    >
      {entries.map((entry) => (
        // A "janela" (essentials_scy.png, único item com `speed`) é
        // renderizada aqui como imagem estática -- a animação de
        // parallax/scroll horizontal (usando `speed`) é refinamento futuro,
        // não implementada nesta etapa.
        <img
          key={entry.asset}
          src={entry.asset}
          alt=""
          // max-w-none: mesma precaução do RoomRacksLayer -- o preflight do
          // Tailwind capa <img> em max-width:100% do pai por padrão, o que
          // já causou um bug real de imagem espremida/duplicada nos racks
          // (ver comentário em RoomRacksLayer.tsx). Nenhuma decoração hoje
          // excede a largura do container (720px), mas evita a mesma classe
          // de bug se isso mudar.
          className="absolute max-w-none"
          style={{ left: entry.left, top: entry.top, width: entry.width, height: entry.height }}
        />
      ))}
    </div>
  )
}
