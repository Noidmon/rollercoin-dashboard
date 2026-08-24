import { cellToPixel, type PixelPosition } from '../data/cellToPixel'
import type { Rack } from './calculatePower'
import type { RackImageMetrics } from './rackTrimBox'

// CORREÇÃO (Prompt 52): 75x120 NÃO é o tamanho renderizado da imagem do
// rack -- é o tamanho da CAIXA-ALVO (slot) pra onde o conteúdo REAL
// (não-transparente) da imagem é escalado. A confusão original (Prompt 50)
// veio de supor que rack_info.width/height (células) determinava o tamanho
// do rack proporcionalmente -- só que TODOS os 72 racks do catálogo
// compartilham o MESMO canvas nativo (126x100px, confirmado medindo os
// arquivos reais), não importa se são 2x3 ou 2x4 células. Usar 75x120
// direto como `width`/`height` da tag <img> (como o Prompt 50 fazia)
// deixava todo rack com a MESMA proporção visual, escondendo a diferença
// real entre 2x3 e 2x4 -- que está em quanto do canvas de 126x100 cada
// desenho ocupa (via alpha), não no arquivo em si. Ver rackTrimBox.ts pro
// cálculo real (crop por canal alfa + escala), extraído do bundle de
// produção do minaryganar.
export const RACK_BOX_WIDTH_PX = 75
export const RACK_BOX_HEIGHT_PX = 120

// Constantes de posicionamento de MINERADOR dentro do rack -- objeto `Ir`
// (minerAnchor) no bundle real.
const MINER_SINGLE_CELL_X_OFFSET = 17
const MINER_SHELF_PITCH = 32
const MINER_BASE_LIFT = 10
const MINER_SPRITE_SCALE = 0.5

// BUG corrigido (achado no debug pós-Prompt 50, com dado real): cellToPixel()
// devolve o ponto de ANCORAGEM do rack -- centro horizontal + base inferior
// -- NÃO o canto superior esquerdo da caixa 75x120px. Usar left/top direto
// como estava fazendo (Prompt 50) deslocava todo rack ~37px pra direita e
// ~120px pra baixo da posição real, causando a sobreposição com a
// decoração vista nos screenshots de debug.
//
// Confirmado direto na função de render real (`ra`, componente por-rack):
//   style: { left: slot.left - j.width/2, top: slot.top - j.height, ... }
// Mesma convenção de ancoragem (centro-x/base-y) já usada por
// minerPixelBoxInRack -- não é coincidência, os dois usam o mesmo sistema.
export function rackPixelBox(anchor: PixelPosition): { left: number; top: number } {
  return {
    left: anchor.left - RACK_BOX_WIDTH_PX / 2,
    top: anchor.top - RACK_BOX_HEIGHT_PX,
  }
}

export interface RackImageRenderBox {
  left: number
  top: number
  width: number
  height: number
}

// Posição/tamanho da imagem INTEIRA do rack (não só a parte recortada),
// relativa ao canto superior esquerdo do slot 75x120 (que tem
// overflow:hidden -- a imagem escalada extrapola o slot na maior parte dos
// casos e fica cortada visualmente pelo container, de propósito).
//
// Fórmula extraída do bundle de produção real do minaryganar:
//   scaleX = RACK_BOX_WIDTH_PX  / (trimBox.right  - trimBox.left)
//   scaleY = RACK_BOX_HEIGHT_PX / (trimBox.bottom - trimBox.top)
//   width  = naturalWidth  * scaleX   -- imagem INTEIRA escalada, não só o recorte
//   height = naturalHeight * scaleY
//   left = -trimBox.left * scaleX     -- desloca a imagem pra alinhar o
//   top  = RACK_BOX_HEIGHT_PX - trimBox.bottom * scaleY   -- recorte com a caixa-alvo
export function rackImageRenderBox(metrics: RackImageMetrics): RackImageRenderBox {
  const { trimBox, naturalWidth, naturalHeight } = metrics
  const scaleX = RACK_BOX_WIDTH_PX / (trimBox.right - trimBox.left)
  const scaleY = RACK_BOX_HEIGHT_PX / (trimBox.bottom - trimBox.top)

  return {
    left: -trimBox.left * scaleX,
    top: RACK_BOX_HEIGHT_PX - trimBox.bottom * scaleY,
    width: naturalWidth * scaleX,
    height: naturalHeight * scaleY,
  }
}

const GAME_SPRITE_SCALE = 0.5

export interface RackGameSpriteBox {
  left: number
  top: number
  frameWidth: number // largura de UM estado (a imagem tem 2 lado a lado: normal + selecionado)
  frameHeight: number
}

// Caminho PRIMÁRIO de renderização (Prompt 52, 2ª rodada) -- descoberto
// lendo o bundle real (função Zn/hook Qn): existe uma variante "game" de
// cada rack (rollercoin/racks/game/{rack_id}.png, pública, sincronizada por
// scripts/sync-rack-game-sprites.js) que já vem na PROPORÇÃO CERTA por
// linha -- sem precisar de recorte por canal alfa. É um spritesheet de 2
// estados lado a lado (normal | selecionado, mesma largura cada);
// confirmado com 6 racks reais da NoID (2x3 e 2x4): largura nativa sempre
// 300px (150 por estado), altura nativa varia com o número de linhas
// (~176-180 pra 2x3, ~240-244 pra 2x4).
//
// Fórmula (extraída do bundle, função Jn):
//   frameWidth  = (naturalWidth / 2) * 0.5   -- metade da imagem (1 estado), depois escala .5
//   frameHeight = naturalHeight * 0.5
//   left = RACK_BOX_WIDTH_PX/2 - frameWidth/2   -- centralizado horizontalmente
//   top  = RACK_BOX_HEIGHT_PX - frameHeight     -- ancorado na base (mesma convenção de sempre)
export function rackGameSpriteBox(naturalWidth: number, naturalHeight: number): RackGameSpriteBox {
  const frameWidth = (naturalWidth / 2) * GAME_SPRITE_SCALE
  const frameHeight = naturalHeight * GAME_SPRITE_SCALE

  return {
    left: RACK_BOX_WIDTH_PX / 2 - frameWidth / 2,
    top: RACK_BOX_HEIGHT_PX - frameHeight,
    frameWidth,
    frameHeight,
  }
}

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

// Caixa de referência do spritesheet de minerador -- `nn={width:126,
// height:100}` no bundle real. Achado do Prompt 55: NÃO é o mesmo `As` que
// eu tinha rotulado antes como "provável tamanho de célula de miner" (essa
// nota era um chute do início da investigação, nunca confirmado -- `As`
// acabou sendo só um fallback de carregamento de RACK, sem relação com
// isso aqui). `nn` é uma constante DISTINTA, genuinamente usada na fórmula
// de miner abaixo, confirmada lendo o bundle de novo.
const MINER_REFERENCE_WIDTH = 126
const MINER_REFERENCE_HEIGHT = 100

export interface MinerPixelBox {
  left: number
  top: number
  width: number
}

// Posição/tamanho de UM minerador DENTRO do rack -- fórmula real extraída
// do bundle (função `eo` de RoomSimulatorPublicPage.js), branch de
// fallback (GIF simples via `miners/{filename}.gif`) -- é a branch que
// bate com o que a gente usa (miners.json só tem imagem `.gif` plana, não
// um "sheet" com múltiplos frames de animação; a branch `!x`/"sheet" do
// bundle depende de um asset que não temos acesso público, não implementada).
//
// Achado importante do Prompt 55 (CORRIGE o que tinha antes): a largura
// renderizada NÃO escala com o frameWidth do minerador -- é uma constante
// (nn.width * spriteScale) igual pra TODO minerador. Só a ALTURA muda por
// minerador, e nem isso é setado explicitamente: o bundle deixa a altura
// "auto" (proporção natural da imagem) e usa `transform:translateY(-100%)`
// pra ancorar pela base sem precisar saber a altura de antemão. O
// frameHeight do minerador entra só no offset de centralização vertical
// `_`, não redimensiona nada.
//
//   r = miner.width===1 ? (miner.x===0 ? -17 : singleCellXOffset) : 0
//   a = -(rackHeightCells - 1 - miner.y) * shelfPitch - baseLift
//   centerX = RACK_BOX_WIDTH_PX/2 + r        -- ponto de ancoragem horizontal (centro)
//   bottomY = RACK_BOX_HEIGHT_PX + a         -- ponto de ancoragem vertical (base)
//   renderedWidth = MINER_REFERENCE_WIDTH * spriteScale         -- CONSTANTE, não por-minerador
//   centeringOffset = (MINER_REFERENCE_HEIGHT - frameHeight) / 2 * spriteScale
//   left = centerX - renderedWidth/2
//   top  = bottomY + centeringOffset   -- topo do <img>, ANTES do translateY(-100%)
export function minerPixelBoxInRack(
  rackHeightCells: number,
  miner: { x: number; y: number; width: number; frameHeight?: number },
): MinerPixelBox {
  const xOffset =
    miner.width === 1 ? (miner.x === 0 ? -MINER_SINGLE_CELL_X_OFFSET : MINER_SINGLE_CELL_X_OFFSET) : 0
  const yOffset = -(rackHeightCells - 1 - miner.y) * MINER_SHELF_PITCH - MINER_BASE_LIFT

  const centerX = RACK_BOX_WIDTH_PX / 2 + xOffset
  const bottomY = RACK_BOX_HEIGHT_PX + yOffset

  const frameHeight = miner.frameHeight ?? 50
  const renderedWidth = MINER_REFERENCE_WIDTH * MINER_SPRITE_SCALE
  const centeringOffset = ((MINER_REFERENCE_HEIGHT - frameHeight) / 2) * MINER_SPRITE_SCALE

  return {
    left: centerX - renderedWidth / 2,
    top: bottomY + centeringOffset,
    width: renderedWidth,
  }
}

// Tamanho/gap dos selos de nível/set -- `V={width:11,height:8,gap:4}` no
// bundle real (importado de gameSprites.js, mesma constante usada em
// outras páginas do projeto pra badge de nível -- não confundir com o
// V/`ks`/`j` dos racks, nomes minificados coincidem entre módulos
// diferentes).
export const MINER_BADGE_WIDTH = 11
export const MINER_BADGE_HEIGHT = 8
const MINER_BADGE_GAP = 4

// Defaults usados SÓ pra ancorar o selo (não pro sprite do minerador em
// si, que usa a caixa nn/constante desde o Prompt 55) -- confirmado lendo
// a função real (`eo`) de novo: o selo usa uma caixa DIFERENTE (`R`),
// baseada no frameWidth/frameHeight do PRÓPRIO minerador, a mesma fórmula
// "antiga" que a gente usava pro sprite antes da correção do Prompt 55.
// Não é inconsistência nossa -- o bundle real realmente ancora o selo
// numa caixa diferente da usada pro sprite.
const MINER_BADGE_ANCHOR_DEFAULT_FRAME_WIDTH = 116
const MINER_BADGE_ANCHOR_DEFAULT_FRAME_HEIGHT = 50

export interface MinerLevelBadgeEntry {
  asset: string // caminho tipo "rollercoin/levels/level_3.webp" -- resolver via resolveAssetUrl
  alt: string
  left: number
  top: number
}

// Selos de nível (e, se aplicável, de set) sobrepostos no minerador --
// fórmula real extraída do bundle (`Lt()`, RoomSimulatorPublicPage.js).
// Nunca implementado antes na sala (só existia em /mineradores, num
// contexto de catálogo, não de overlay posicional) -- por isso "selo de
// nível" ficou de fora da Fase B até agora, não é regressão de código já
// escrito, é feature nunca portada pro visual da sala.
//
//   isLegacy = type==="old_merge" || type==="legacy"
//   displayLevel = isLegacy ? 7 : level+1   -- level do room-config é
//     0-indexed (nº de merges feitos); o selo mostra o nível de raridade
//     1-indexed (confirmado comparando room-config real contra
//     miners.json em investigação anterior)
//   mostra o selo de nível só se isLegacy OU (type==="merge" && level>0)
//     -- minerador base (level 0) não tem selo nenhum
//   asset = displayLevel>=7 ? "levels/level_legacy.webp" : `levels/level_${displayLevel}.webp`
//   se isInSet, adiciona um 2º selo "levels/level_set.webp" à direita do
//     primeiro (offsetX = nº de selos já colocados × (largura+gap))
export function minerLevelBadges(
  rackHeightCells: number,
  miner: {
    x: number
    y: number
    width: number
    frameWidth?: number
    frameHeight?: number
    type?: string
    level?: number
    isInSet?: boolean
  },
): MinerLevelBadgeEntry[] {
  const xOffset =
    miner.width === 1 ? (miner.x === 0 ? -MINER_SINGLE_CELL_X_OFFSET : MINER_SINGLE_CELL_X_OFFSET) : 0
  const yOffset = -(rackHeightCells - 1 - miner.y) * MINER_SHELF_PITCH - MINER_BASE_LIFT
  const centerX = RACK_BOX_WIDTH_PX / 2 + xOffset
  const bottomY = RACK_BOX_HEIGHT_PX + yOffset

  const anchorFrameWidth = (miner.frameWidth ?? MINER_BADGE_ANCHOR_DEFAULT_FRAME_WIDTH) * MINER_SPRITE_SCALE
  const anchorFrameHeight = (miner.frameHeight ?? MINER_BADGE_ANCHOR_DEFAULT_FRAME_HEIGHT) * MINER_SPRITE_SCALE
  const anchorLeft = centerX - anchorFrameWidth / 2
  const anchorTop = bottomY - anchorFrameHeight

  const entries: { asset: string; alt: string; offsetX: number }[] = []

  const isLegacy = miner.type === 'old_merge' || miner.type === 'legacy'
  const level = miner.level ?? 0
  if (isLegacy || (miner.type === 'merge' && level > 0)) {
    const displayLevel = isLegacy ? 7 : level + 1
    const isMax = displayLevel >= 7
    entries.push({
      asset: isMax ? 'rollercoin/levels/level_legacy.webp' : `rollercoin/levels/level_${displayLevel}.webp`,
      alt: isMax ? 'legacy' : `nivel ${displayLevel}`,
      offsetX: 0,
    })
  }

  if (miner.isInSet) {
    entries.push({
      asset: 'rollercoin/levels/level_set.webp',
      alt: 'set',
      offsetX: entries.length * (MINER_BADGE_WIDTH + MINER_BADGE_GAP),
    })
  }

  return entries.map((entry) => ({
    asset: entry.asset,
    alt: entry.alt,
    left: anchorLeft + entry.offsetX,
    top: anchorTop,
  }))
}
