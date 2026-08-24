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
//
// scale nunca passa de 1 (Math.min) -- a sala não deve ficar maior que o
// tamanho nativo 720x450 em telas largas, só menor quando o espaço
// disponível for menor que isso.
//
// Estrutura em DOIS divs de propósito: o de FORA (`measureRef`, `w-full`)
// só serve pra medir a largura real disponível via ResizeObserver -- ele
// PRECISA continuar respondendo ao pai (`w-full`) pra continuar
// remedindo quando a tela redimensiona. O de DENTRO (`sizedRef` implícito)
// tem largura/altura FIXA calculada a partir da escala já capada -- é ele
// quem visualmente ocupa só o espaço do conteúdo escalado (sem isso, o
// container externo continuaria do tamanho do pai mesmo com o conteúdo
// escalado pra baixo, sobrando área vazia ao redor).
export default function ScaledRoomCanvas({ children }: { children: ReactNode }) {
  const measureRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = measureRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setScale(Math.min(1, width / ROOM_WIDTH))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={measureRef} className="w-full">
      <div
        className="overflow-hidden rounded-md"
        style={{ width: ROOM_WIDTH * scale, height: ROOM_HEIGHT * scale }}
      >
        <div
          // relative: âncora pra RoomRacksLayer, que devolve filhos
          // position:absolute soltos (fragment, sem wrapper próprio) --
          // antes era o div em Simulador.tsx que fazia esse papel.
          className="relative"
          style={{
            width: ROOM_WIDTH,
            height: ROOM_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
