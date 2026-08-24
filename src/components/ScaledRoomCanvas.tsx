import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ROOM_HEIGHT, ROOM_WIDTH } from './RoomBackground'

// Escala o conteúdo da sala (fixo em 720x450 -- RoomBackground/RoomRacksLayer
// posicionam tudo em pixels absolutos nessa escala) pra ocupar a largura
// real disponível do container pai, em vez de um tamanho fixo pequeno.
// Mesma técnica confirmada no bundle real do minaryganar (`transform:
// scale(d)` sobre um container de tamanho fixo) -- escalar via CSS
// transform preserva toda a matemática de posicionamento em pixels já
// implementada (cellToPixel, rackPixelBox, etc), sem precisar reescrever
// nada em porcentagem.
export default function ScaledRoomCanvas({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setScale(width / ROOM_WIDTH)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded-md"
      style={{ aspectRatio: `${ROOM_WIDTH} / ${ROOM_HEIGHT}` }}
    >
      <div
        // relative: âncora pra RoomRacksLayer, que devolve filhos
        // position:absolute soltos (fragment, sem wrapper próprio) --
        // antes era o div em Simulador.tsx que fazia esse papel.
        className="relative"
        style={{ width: ROOM_WIDTH, height: ROOM_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {children}
      </div>
    </div>
  )
}
