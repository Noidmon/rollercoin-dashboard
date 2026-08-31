// Sincroniza a lista completa de mineradores da API pública do Minar y Ganar
// pra public/data/miners.json + imagens em public/miners-icons/. Reutilizável
// -- roda de novo quando quiser atualizar (idempotente: pula imagens já
// baixadas, sempre reescreve o miners.json do zero a partir da API).
//
// Uso:
//   node scripts/sync-miners-data.js
//
// Fonte: https://api.minaryganar.com/api/public/miners (paginada, per_page
// máximo 24 -- limite do próprio backend deles -- exige header Referer, sem
// isso dá 403). O endpoint de detalhe por slug (/api/public/miners/{slug})
// de propósito NÃO é usado aqui: todos os campos que precisamos já vêm da
// lista, e bater o detalhe de cada um dos 1673 mineradores seria 1673
// requisições a mais sem necessidade.

import { writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJsonIfChanged } from './lib/writeJsonIfChanged.js'
import { fetchJson } from './lib/fetchJsonWithRetry.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ICONS_DIR = join(ROOT, 'public', 'miners-icons')
const DATA_DIR = join(ROOT, 'public', 'data')
const MINERS_JSON_PATH = join(DATA_DIR, 'miners.json')
const CRAFTING_PRICES_PATH = join(DATA_DIR, 'crafting-prices.json')

const API_BASE = 'https://api.minaryganar.com/api/public'
const REFERER = 'https://minaryganar.com/'
const PAGE_SIZE = 24
// Era 150ms -- aumentado depois de um 429 em produção na página 67/71 (retry
// com backoff em fetchJson é a correção principal, isso aqui só reduz a
// chance de precisar dele).
const PAGE_DELAY_MS = 300
// Não pedido explicitamente, mas com ~1673 imagens únicas em jogo, um delay
// pequeno entre downloads evita martelar o servidor de assets deles também.
const IMAGE_DELAY_MS = 50

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchAllMiners() {
  const rawMiners = []
  let page = 1
  let total = 0
  let totalMerges = 0

  for (;;) {
    const data = await fetchJson(`${API_BASE}/miners?page=${page}&per_page=${PAGE_SIZE}`, {
      headers: { Referer: REFERER },
    })
    total = data.total
    totalMerges = data.total_merges
    rawMiners.push(...data.items)
    console.log(`página ${page}/${data.total_pages} (${data.items.length} mineradores)`)

    if (!data.has_next) break
    page++
    await sleep(PAGE_DELAY_MS)
  }

  return { rawMiners, total, totalMerges }
}

function toNumber(value) {
  return value === null || value === undefined ? value : Number(value)
}

function normalizeMerge(merge) {
  return {
    mergeId: merge.merge_id,
    level: merge.level,
    power: toNumber(merge.power),
    bonus: toNumber(merge.bonus),
    mergeFee: toNumber(merge.merge_fee),
    requiredPreviousCount: merge.required_previous_count,
    fanCount: merge.fan_count,
    fanLevel: merge.fan_level,
    hashboardCount: merge.hashboard_count,
    hashboardLevel: merge.hashboard_level,
    wireCount: merge.wire_count,
    wireLevel: merge.wire_level,
    requirements: merge.requirements,
  }
}

function normalizeMiner(raw, imagePathToLocal) {
  return {
    id: raw.miner_id,
    name: raw.name,
    slug: raw.slug,
    sellable: raw.sellable,
    mergeable: raw.mergeable,
    power: toNumber(raw.power),
    bonus: toNumber(raw.bonus),
    cells: raw.cells,
    image: imagePathToLocal.get(raw.image_path) ?? null,
    marketplaceUrl: `https://rollercoin.com/marketplace/buy/miner/${raw.miner_id}`,
    merges: (raw.merges ?? []).map(normalizeMerge),
  }
}

async function downloadImage(imagePath) {
  const filename = basename(imagePath)
  const localFsPath = join(ICONS_DIR, filename)
  const localUrlPath = `/miners-icons/${filename}`

  if (existsSync(localFsPath)) {
    return { localUrlPath, downloaded: false }
  }

  const response = await fetch(`https://api.minaryganar.com/assets/${imagePath}`)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  mkdirSync(ICONS_DIR, { recursive: true })
  writeFileSync(localFsPath, buffer)
  return { localUrlPath, downloaded: true }
}

async function syncImages(rawMiners) {
  const uniquePaths = [...new Set(rawMiners.map((m) => m.image_path).filter(Boolean))]
  const imagePathToLocal = new Map()
  let downloadedCount = 0
  let alreadyExistingCount = 0
  let failedCount = 0

  for (let i = 0; i < uniquePaths.length; i++) {
    const imagePath = uniquePaths[i]
    try {
      const { localUrlPath, downloaded } = await downloadImage(imagePath)
      imagePathToLocal.set(imagePath, localUrlPath)
      if (downloaded) {
        downloadedCount++
        if ((i + 1) % 100 === 0) {
          console.log(`  ${i + 1}/${uniquePaths.length} imagens processadas...`)
        }
        await sleep(IMAGE_DELAY_MS)
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
    failedCount,
    uniqueCount: uniquePaths.length,
  }
}

async function syncCraftingPrices() {
  const data = await fetchJson(`${API_BASE}/rollercoin/craftings`, { headers: { Referer: REFERER } })
  mkdirSync(DATA_DIR, { recursive: true })
  // Escreve incondicionalmente antes -- diferente de miners.json/racks.json/
  // miner-sets.json, esse arquivo NUNCA teve um `generatedAt` embutido, então
  // na prática nunca gerou diff falso (JSON.stringify de um objeto igual
  // produz os MESMOS bytes, git não vê mudança por conteúdo) -- confirmado
  // no histórico real (só 1 commit desde a criação, apesar de rodar dezenas
  // de vezes). Ainda assim, mesmo helper aqui por consistência e defesa
  // (não depender de determinismo incidental, e ganhar o mesmo log
  // "sem mudança real" dos outros 3 arquivos).
  const { written } = writeJsonIfChanged(CRAFTING_PRICES_PATH, data.default_component_prices, { space: 2 })
  const tierCount = Object.keys(data.default_component_prices).length
  console.log(
    written
      ? `crafting-prices.json salvo (${tierCount} tiers)`
      : `crafting-prices.json: sem mudança real -- arquivo intocado (${tierCount} tiers)`,
  )
}

async function main() {
  console.log('buscando lista de mineradores...')
  const { rawMiners, total, totalMerges } = await fetchAllMiners()
  console.log(`${rawMiners.length} mineradores buscados (API reporta total=${total})`)

  console.log('')
  console.log('sincronizando imagens...')
  const imageSync = await syncImages(rawMiners)

  const miners = rawMiners.map((raw) => normalizeMiner(raw, imageSync.imagePathToLocal))

  const output = {
    generatedAt: new Date().toISOString(),
    total,
    totalMerges,
    miners,
  }

  mkdirSync(DATA_DIR, { recursive: true })
  const { written } = writeJsonIfChanged(MINERS_JSON_PATH, output)

  console.log('')
  console.log('sincronizando preços de crafting...')
  await syncCraftingPrices()

  const sizeBytes = statSync(MINERS_JSON_PATH).size
  const sizeKb = sizeBytes / 1024
  const sizeLabel = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(2)} MB` : `${sizeKb.toFixed(1)} KB`

  console.log('')
  console.log('--- resumo ---')
  console.log(`mineradores processados: ${miners.length}`)
  console.log(
    `imagens: ${imageSync.uniqueCount} únicas -- ${imageSync.downloadedCount} baixadas agora, ${imageSync.alreadyExistingCount} já existentes`,
  )
  if (imageSync.failedCount > 0) console.log(`imagens que falharam: ${imageSync.failedCount}`)
  console.log(
    written
      ? `miners.json: ${sizeLabel} (reescrito -- catálogo mudou)`
      : `miners.json: ${sizeLabel} (sem mudança real -- generatedAt antigo mantido, arquivo intocado)`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
