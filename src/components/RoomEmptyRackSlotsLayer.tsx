import { allCellsForRoomLevel } from '../data/cellToPixel'
import { rackPixelBox, RACK_BOX_HEIGHT_PX, RACK_BOX_WIDTH_PX } from '../utils/roomLayout'
import type { RemovedRackEntry } from '../hooks/useRemovedRacks'

// Camada de posições VAZIAS da sala (Prompt 84 -- 2º gatilho de
// recolocação de rack desmontada) -- irmã de RoomRacksLayer, não parte
// dela: RoomRacksLayer só sabe desenhar racks OCUPADAS (via `placements`,
// já filtradas); aqui a fonte é a tabela `Dr` inteira (allCellsForRoomLevel,
// TODAS as posições fisicamente válidas daquela sala, confirmadas contra o
// bundle real -- ver cellToPixel.ts) menos as já ocupadas. Só renderiza (e
// só reage a clique/drop) na aba "Simulação" -- mesma convenção de
// onRackClick/draggedEntry em RoomRacksLayer (undefined = view somente-
// leitura na aba "Atual").
interface RoomEmptyRackSlotsLayerProps {
  roomLevel: number
  occupiedXY: Set<string>
  draggedRack?: RemovedRackEntry | null
  onSlotClick?: (x: number, y: number) => void
  onDropRack?: (x: number, y: number) => void
}

export default function RoomEmptyRackSlotsLayer({
  roomLevel,
  occupiedXY,
  draggedRack,
  onSlotClick,
  onDropRack,
}: RoomEmptyRackSlotsLayerProps) {
  if (!onSlotClick && !onDropRack) return null

  const emptyCells = allCellsForRoomLevel(roomLevel).filter((cell) => !occupiedXY.has(`${cell.x},${cell.y}`))

  return (
    <>
      {emptyCells.map((cell) => {
        const box = rackPixelBox(cell.pixelPosition)
        const isCompatible = !!draggedRack
        return (
          <div
            key={`empty-rack-${cell.x}-${cell.y}`}
            className={`absolute cursor-pointer rounded transition-colors ${
              isCompatible
                ? 'border-2 border-emerald-400 bg-emerald-400/25'
                : 'border border-dashed border-slate-600/50 hover:border-slate-400/70 hover:bg-slate-400/10'
            }`}
            style={{ left: box.left, top: box.top, width: RACK_BOX_WIDTH_PX, height: RACK_BOX_HEIGHT_PX }}
            title="Posição vazia -- clique pra recolocar uma rack desmontada"
            onClick={() => onSlotClick?.(cell.x, cell.y)}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = isCompatible ? 'copy' : 'none'
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (!draggedRack) return
              onDropRack?.(cell.x, cell.y)
            }}
          />
        )
      })}
    </>
  )
}
