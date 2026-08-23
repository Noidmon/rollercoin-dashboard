import { cellToPixel, type PixelPosition } from '../data/cellToPixel'
import type { Rack } from './calculatePower'

// Tamanho FIXO da caixa de renderização de um rack em pixels -- confirmado
// direto no bundle do minaryganar (duas constantes independentes, `j` e
// `ks`, com o MESMO valor: {width:75,height:120}). Documentado em
// docs/room-layout-investigation.md.
//
// Achado importante (diferente do que se poderia supor): o tamanho NÃO
// escala com rack_info.width/height (células) -- um rack 2x3 (6 células) e
// um rack 2x4 (8 células) usam a MESMA caixa 75x120px. O que muda é como as
// linhas de mineradores se distribuem dentro dela (ver
// minerPixelBoxInRack), não o tamanho externo do rack. Confirmado lendo a
// função real de posicionamento (`eo`/`Tt` no bundle), não é suposição.
export const RACK_BOX_WIDTH_PX = 75
export const RACK_BOX_HEIGHT_PX = 120

// Constantes de posicionamento de MINERADOR dentro do rack -- objeto `Ir`
// (minerAnchor) no bundle real.
const MINER_SINGLE_CELL_X_OFFSET = 17
const MINER_SHELF_PITCH = 32
const MINER_BASE_LIFT = 10
const MINER_SPRITE_SCALE = 0.5

// Um rack real, posicionado numa sala real -- extraído de room-config via
// roomConfigToRackPlacements(). Deliberadamente achatado (sem os
// mineradores aninhados dentro) pra RoomRacksLayer poder receber `miners`
// como prop separada, do jeito que já vem de playerData.roomConfig.miners,
// sem duplicar extração.
export interface RackPlacement {
  instanceId: string // room-config racks[]._id -- usado pra casar com miner.placement.user_rack_id
  rackId: string | undefined // catálogo (racks.json) -- rack_id
  name: string
  roomLevel: number
  x: number
  y: number
  widthCells: number
  heightCells: number
  // null quando (roomLevel,x,y) não tem entrada confirmada em
  // cellToPixel() -- ver comentário lá. RoomRacksLayer pula esses racks
  // (com aviso), não inventa uma posição aproximada.
  pixelPosition: PixelPosition | null
}

// Função PURA -- só lê roomConfig.racks, não busca nada sozinha. Pensada
// pra também aceitar, no futuro, um roomConfig SIMULADO pelo
// Auto-Otimizador (mesma forma de racks[], sem precisar vir de uma conta
// real), sem duplicar essa lógica de extração.
export function roomConfigToRackPlacements(roomConfig: { racks: Rack[] }): RackPlacement[] {
  return roomConfig.racks
    .filter((rack): rack is Rack & { placement: NonNullable<Rack['placement']>; rack_info: NonNullable<Rack['rack_info']> } =>
      rack.placement !== undefined && rack.rack_info !== undefined,
    )
    .map((rack) => ({
      instanceId: rack._id,
      rackId: rack.rack_id,
      name: rack.name ?? rack._id,
      roomLevel: rack.placement.room_level,
      x: rack.placement.x,
      y: rack.placement.y,
      widthCells: rack.rack_info.width,
      heightCells: rack.rack_info.height,
      pixelPosition: cellToPixel(rack.placement.room_level, rack.placement.x, rack.placement.y),
    }))
}

export interface MinerPixelBox {
  left: number
  top: number
  width: number
  height: number
}

// Posição de UM minerador DENTRO do rack (coordenadas locais ao rack, 0,0 =
// canto superior esquerdo da caixa de 75x120px do rack) -- fórmula real
// extraída do bundle (função `eo`/helper `Xo` de gameSprites.js), não
// aproximada:
//
//   r = miner.width===1 ? (miner.x===0 ? -17 : singleCellXOffset) : 0
//   a = -(rackHeightCells - 1 - miner.y) * shelfPitch - baseLift
//   centerX = RACK_BOX_WIDTH_PX/2 + r      -- ponto de ancoragem horizontal (centro)
//   bottomY = RACK_BOX_HEIGHT_PX + a       -- ponto de ancoragem vertical (base)
//   width  = (frameWidth  ?? 116) * spriteScale
//   height = (frameHeight ?? 50)  * spriteScale
//   left = centerX - width/2
//   top  = bottomY - height
export function minerPixelBoxInRack(
  rackHeightCells: number,
  miner: { x: number; y: number; width: number; frameWidth?: number; frameHeight?: number },
): MinerPixelBox {
  const xOffset =
    miner.width === 1 ? (miner.x === 0 ? -MINER_SINGLE_CELL_X_OFFSET : MINER_SINGLE_CELL_X_OFFSET) : 0
  const yOffset = -(rackHeightCells - 1 - miner.y) * MINER_SHELF_PITCH - MINER_BASE_LIFT

  const centerX = RACK_BOX_WIDTH_PX / 2 + xOffset
  const bottomY = RACK_BOX_HEIGHT_PX + yOffset

  const width = (miner.frameWidth ?? 116) * MINER_SPRITE_SCALE
  const height = (miner.frameHeight ?? 50) * MINER_SPRITE_SCALE

  return { left: centerX - width / 2, top: bottomY - height, width, height }
}
