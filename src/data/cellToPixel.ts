// Tabela de conversão célula -> pixel pra posicionamento de RACKS na sala.
// Transcrita literalmente da tabela `Dr` (viewport desktop) documentada em
// docs/room-layout-investigation.md, extraída direto do bundle JS real do
// simulador de sala do minaryganar.com -- NÃO é uma fórmula (o passo entre
// células não é uniforme, varia entre 85px e 95px conforme a posição, pra
// bater com os compartimentos irregulares da estante desenhada). Nunca
// interpolar/aproximar por fórmula linear -- se uma posição não estiver
// aqui, cellToPixel retorna null e quem chamar deve tratar isso como dado
// faltante, não adivinhar.
//
// Nível 0 tem sua própria tabela (12 posições, grade 4x3). Níveis 1, 2 e 3
// compartilham EXATAMENTE a mesma tabela (18 posições, grade 6x3) --
// confirmado no bundle (mesma referência Dr.desktop pros 3 níveis).
export interface PixelPosition {
  left: number
  top: number
}

type CellKey = `${number},${number}`

const LEVEL_0_TABLE: Record<CellKey, PixelPosition> = {
  '0,0': { left: 48, top: 289 },
  '1,0': { left: 133, top: 289 },
  '2,0': { left: 228, top: 289 },
  '3,0': { left: 313, top: 289 },
  '0,1': { left: 408, top: 289 },
  '1,1': { left: 493, top: 289 },
  '2,1': { left: 588, top: 289 },
  '3,1': { left: 673, top: 289 },
  '0,2': { left: 228, top: 439 },
  '1,2': { left: 313, top: 439 },
  '2,2': { left: 408, top: 439 },
  '3,2': { left: 493, top: 439 },
}

// Compartilhada pelos níveis 1, 2 e 3.
const LEVELS_1_TO_3_TABLE: Record<CellKey, PixelPosition> = {
  '0,0': { left: 228, top: 139 },
  '1,0': { left: 313, top: 139 },
  '2,0': { left: 408, top: 139 },
  '3,0': { left: 493, top: 139 },
  '4,0': { left: 48, top: 289 },
  '5,0': { left: 133, top: 289 },
  '0,1': { left: 228, top: 289 },
  '1,1': { left: 313, top: 289 },
  '2,1': { left: 408, top: 289 },
  '3,1': { left: 493, top: 289 },
  '4,1': { left: 588, top: 289 },
  '5,1': { left: 673, top: 289 },
  '0,2': { left: 48, top: 439 },
  '1,2': { left: 133, top: 439 },
  '2,2': { left: 228, top: 439 },
  '3,2': { left: 313, top: 439 },
  '4,2': { left: 408, top: 439 },
  '5,2': { left: 493, top: 439 },
}

const TABLE_BY_ROOM_LEVEL: Record<number, Record<CellKey, PixelPosition>> = {
  0: LEVEL_0_TABLE,
  1: LEVELS_1_TO_3_TABLE,
  2: LEVELS_1_TO_3_TABLE,
  3: LEVELS_1_TO_3_TABLE,
}

// Retorna null (não um fallback aproximado) quando roomLevel/x/y não têm
// entrada confirmada na tabela -- ver comentário no topo do arquivo.
export function cellToPixel(roomLevel: number, x: number, y: number): PixelPosition | null {
  const table = TABLE_BY_ROOM_LEVEL[roomLevel]
  if (!table) return null
  return table[`${x},${y}`] ?? null
}
