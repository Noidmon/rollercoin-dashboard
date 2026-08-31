// Sincroniza a lista completa de racks da API pública do Minar y Ganar pra
// public/data/racks.json + imagens em public/racks-icons/. Reutilizável --
// roda de novo quando quiser atualizar (idempotente: pula imagens já
// baixadas, sempre reescreve o racks.json do zero a partir da API). Mesmo
// padrão de scripts/sync-miners-data.js.
//
// Uso:
//   node scripts/sync-racks-data.js
//
// Fonte: https://api.minaryganar.com/api/public/racks (paginada, per_page
// máximo 24, exige header Referer, sem isso dá 403). Diferente do endpoint
// de mineradores, a resposta daqui NÃO tem has_next/total_pages -- só
// {total, items} -- por isso o critério de parada é items.length===0 (a
// página seguinte a última vem vazia), não um campo de paginação explícito.

import { writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJsonIfChanged } from './lib/writeJsonIfChanged.js'
import { fetchJson } from './lib/fetchJsonWithRetry.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const RACKS_ICONS_DIR = join(ROOT, 'public', 'racks-icons')
const RC_ICONS_DIR = join(ROOT, 'public', 'rc-icons')
const DATA_DIR = join(ROOT, 'public', 'data')
const RACKS_JSON_PATH = join(DATA_DIR, 'racks.json')

const API_BASE = 'https://api.minaryganar.com/api/public'
const REFERER = 'https://minaryganar.com/'
const PAGE_SIZE = 24
// Era 150ms -- ver comentário equivalente em sync-miners-data.js (429 em
// produção na página 67/71 do sync de mineradores, mesma API).
const PAGE_DELAY_MS = 300
const IMAGE_DELAY_MS = 50

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchAllRacks() {
  const rawRacks = []
  let page = 1
  let total = 0

  for (;;) {
    const data = await fetchJson(`${API_BASE}/racks?page=${page}&per_page=${PAGE_SIZE}`, {
      headers: { Referer: REFERER },
    })
    total = data.total
    if (data.items.length === 0) break
    rawRacks.push(...data.items)
    console.log(`página ${page} (${data.items.length} racks, ${rawRacks.length}/${total} até agora)`)

    if (rawRacks.length >= total) break
    page++
    await sleep(PAGE_DELAY_MS)
  }

  return { rawRacks, total }
}

// Deriva width/height (em células) a partir do sufixo numérico do nome --
// confirmado por investigação que todos os 72 racks conhecidos terminam em
// "6" (2x3) ou "8" (2x4). Não usa o campo `cells` da API de propósito (foi
// pedido explicitamente derivar do NOME) -- se algum rack novo aparecer com
// sufixo diferente, isso fica null aqui e é reportado no resumo em vez de
// adivinhar uma proporção.
const SUFFIX_TO_DIMENSIONS = {
  6: { width: 2, height: 3 },
  8: { width: 2, height: 4 },
}

function deriveDimensions(name) {
  const match = name.trim().match(/(\d+)\s*$/)
  const suffix = match ? Number(match[1]) : null
  const dimensions = suffix !== null ? SUFFIX_TO_DIMENSIONS[suffix] : undefined
  return dimensions ?? { width: null, height: null }
}

function toNumber(value) {
  return value === null || value === undefined ? value : Number(value)
}

// Se o arquivo já existir em public/rc-icons/ (baixado antes via reward de
// evento, ex: jet_black_rack_6.webp), reaproveita ele direto -- mesmo
// padrão de tryReuseMinerIcon() em scripts/sync-rc-icons.js, evita duplicar
// o mesmo arquivo em dois diretórios.
function tryReuseFromRcIcons(filename) {
  if (!existsSync(join(RC_ICONS_DIR, filename))) return null
  return `/rc-icons/${filename}`
}

async function downloadImage(imagePath) {
  const filename = basename(imagePath)
  const localFsPath = join(RACKS_ICONS_DIR, filename)
  const localUrlPath = `/racks-icons/${filename}`

  if (existsSync(localFsPath)) {
    return { localUrlPath, downloaded: false, reused: false }
  }

  const reusedUrlPath = tryReuseFromRcIcons(filename)
  if (reusedUrlPath) {
    return { localUrlPath: reusedUrlPath, downloaded: false, reused: true }
  }

  const response = await fetch(`https://api.minaryganar.com/assets/${imagePath}`)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  mkdirSync(RACKS_ICONS_DIR, { recursive: true })
  writeFileSync(localFsPath, buffer)
  return { localUrlPath, downloaded: true, reused: false }
}

async function syncImages(rawRacks) {
  const uniquePaths = [...new Set(rawRacks.map((r) => r.image_path).filter(Boolean))]
  const imagePathToLocal = new Map()
  let downloadedCount = 0
  let alreadyExistingCount = 0
  let reusedFromRcIconsCount = 0
  let failedCount = 0

  for (const imagePath of uniquePaths) {
    try {
      const { localUrlPath, downloaded, reused } = await downloadImage(imagePath)
      imagePathToLocal.set(imagePath, localUrlPath)
      if (downloaded) {
        downloadedCount++
        await sleep(IMAGE_DELAY_MS)
      } else if (reused) {
        reusedFromRcIconsCount++
      } else {
        alreadyExistingCount++
      }
    } catch (err) {
      console.error(`falha ao baixar imagem ${imagePath}: ${err.message}`)
      failedCount++
    }
  }

  return {
    imagePathToLocal,
    downloadedCount,
    alreadyExistingCount,
    reusedFromRcIconsCount,
    failedCount,
    uniqueCount: uniquePaths.length,
  }
}

function normalizeRack(raw, imagePathToLocal, unrecognizedDimensions) {
  const { width, height } = deriveDimensions(raw.name)
  if (width === null) {
    unrecognizedDimensions.push(raw.name)
  }

  return {
    rackId: raw.rack_id,
    name: raw.name,
    image: imagePathToLocal.get(raw.image_path) ?? null,
    bonus: toNumber(raw.rack_bonus),
    cells: raw.cells,
    width,
    height,
  }
}

async function main() {
  console.log('buscando lista de racks...')
  const { rawRacks, total } = await fetchAllRacks()
  console.log(`${rawRacks.length} racks buscados (API reporta total=${total})`)

  console.log('')
  console.log('sincronizando imagens...')
  const imageSync = await syncImages(rawRacks)

  const unrecognizedDimensions = []
  const racks = rawRacks.map((raw) => normalizeRack(raw, imageSync.imagePathToLocal, unrecognizedDimensions))

  const output = {
    generatedAt: new Date().toISOString(),
    total,
    racks,
  }

  mkdirSync(DATA_DIR, { recursive: true })
  const { written } = writeJsonIfChanged(RACKS_JSON_PATH, output)

  const sizeBytes = statSync(RACKS_JSON_PATH).size
  const sizeKb = sizeBytes / 1024
  const sizeLabel = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(2)} MB` : `${sizeKb.toFixed(1)} KB`

  console.log('')
  console.log('--- resumo ---')
  console.log(`racks processados: ${racks.length}`)
  console.log(
    `imagens: ${imageSync.uniqueCount} únicas -- ${imageSync.downloadedCount} baixadas agora, ${imageSync.reusedFromRcIconsCount} reaproveitadas de rc-icons/, ${imageSync.alreadyExistingCount} já existentes em racks-icons/`,
  )
  if (imageSync.failedCount > 0) console.log(`imagens que falharam: ${imageSync.failedCount}`)
  if (unrecognizedDimensions.length > 0) {
    console.log(`racks com sufixo de nome não reconhecido (width/height=null): ${unrecognizedDimensions.length}`)
    for (const name of unrecognizedDimensions) console.log(`  - ${name}`)
  } else {
    console.log('todos os racks tiveram width/height reconhecidos pelo sufixo do nome')
  }
  console.log(
    written
      ? `racks.json: ${sizeLabel} (reescrito -- catálogo mudou)`
      : `racks.json: ${sizeLabel} (sem mudança real -- generatedAt antigo mantido, arquivo intocado)`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
