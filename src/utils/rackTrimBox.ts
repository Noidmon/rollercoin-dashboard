// Recorte real de conteúdo não-transparente de cada imagem de rack --
// necessário porque todos os 72 racks compartilham o MESMO canvas nativo
// (126x100px, confirmado medindo os arquivos reais em public/racks-icons/)
// independente de serem 2x3 ou 2x4 células. A diferença de proporção entre
// um rack 2x3 e um 2x4 está em QUANTO desse canvas de 126x100 o desenho
// realmente ocupa (alpha > 0), não no tamanho do arquivo em si -- por isso
// não dá pra usar naturalWidth/naturalHeight direto como tamanho final.
//
// Lógica confirmada lendo o bundle de produção real do minaryganar (via
// DevTools): pra cada imagem, varre o canal alfa procurando a bounding box
// do conteúdo visível (limiar alpha > 24, ~10% de opacidade), escala essa
// bounding box pra caber exatamente na caixa alvo 75x120 (RACK_BOX_*_PX),
// e desenha a imagem INTEIRA (recortada visualmente pelo container) nessa
// mesma escala.

export interface TrimBox {
  left: number
  top: number
  right: number
  bottom: number
}

export interface RackImageMetrics {
  trimBox: TrimBox
  naturalWidth: number
  naturalHeight: number
}

const ALPHA_THRESHOLD = 24

// Fallback só pra falha real de carregamento/leitura de pixel (ex: CORS) --
// não esperado em uso normal, já que as imagens são same-origin
// (public/racks-icons/ do próprio app). Assume o canvas nativo padrão
// 126x100 visto em todos os racks medidos.
const FALLBACK_TRIM_BOX: TrimBox = { left: 34, top: 4, right: 92, bottom: 96 }
const FALLBACK_NATURAL_WIDTH = 126
const FALLBACK_NATURAL_HEIGHT = 100

function findAlphaBoundingBox(imageData: ImageData): TrimBox | null {
  const { data, width, height } = imageData
  let left = width
  let right = 0
  let top = height
  let bottom = 0
  let found = false

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha > ALPHA_THRESHOLD) {
        found = true
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }

  // +1 nos limites direito/inferior -- right/bottom acima são o ÚLTIMO
  // pixel opaco (índice), não a borda exclusiva da caixa.
  return found ? { left, top, right: right + 1, bottom: bottom + 1 } : null
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`falha ao carregar imagem: ${url}`))
    img.src = url
  })
}

async function computeRackImageMetrics(url: string): Promise<RackImageMetrics> {
  const img = await loadImage(url)
  const naturalWidth = img.naturalWidth
  const naturalHeight = img.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = naturalWidth
  canvas.height = naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context indisponível')

  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, naturalWidth, naturalHeight)
  const trimBox = findAlphaBoundingBox(imageData)

  if (!trimBox) throw new Error(`nenhum pixel opaco encontrado em: ${url}`)

  return { trimBox, naturalWidth, naturalHeight }
}

// Cache por URL -- o scan de pixel é custoso (126x100 = 12600 pixels por
// imagem), mas só precisa rodar UMA vez por TIPO de rack (não por
// instância) -- uma conta com 48 racks pode ter só 13 tipos únicos, por
// exemplo.
const metricsCache = new Map<string, Promise<RackImageMetrics>>()

export function getRackImageMetrics(url: string): Promise<RackImageMetrics> {
  let cached = metricsCache.get(url)
  if (!cached) {
    cached = computeRackImageMetrics(url).catch((err) => {
      console.warn(`rackTrimBox: usando fallback pra ${url} -- ${err.message}`)
      return {
        trimBox: FALLBACK_TRIM_BOX,
        naturalWidth: FALLBACK_NATURAL_WIDTH,
        naturalHeight: FALLBACK_NATURAL_HEIGHT,
      }
    })
    metricsCache.set(url, cached)
  }
  return cached
}
