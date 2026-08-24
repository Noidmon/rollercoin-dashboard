// Sincroniza a variante "game" de cada rack (spritesheet com 2 estados
// lado a lado -- normal e selecionado -- já na proporção correta de
// linhas, sem precisar de recorte por canal alfa) pra
// public/racks-game-icons/. Mesmo padrão idempotente dos outros scripts de
// sync. Lê a lista de rack_id de public/data/racks.json (já sincronizado
// por sync-racks-data.js).
//
// Uso:
//   node scripts/sync-rack-game-sprites.js
//
// Descoberto lendo o bundle de produção real do minaryganar (função Zn,
// hook Qn): a caminho PRIMÁRIO de renderização de rack usa
// rollercoin/racks/game/{rack_id}.png (público, sem autenticação -- mesmo
// padrão já confirmado pra mineradores, rollercoin/miners/game/{slug}.png).
// Só cai no fallback de recorte-por-alfa (rackTrimBox.ts, usando o catálogo
// .webp) se esse arquivo falhar ao carregar. Documentado em
// docs/room-layout-investigation.md.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const RACKS_JSON_PATH = join(ROOT, 'public', 'data', 'racks.json')
const OUTPUT_DIR = join(ROOT, 'public', 'racks-game-icons')

const DOWNLOAD_DELAY_MS = 50

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function downloadSprite(rackId) {
  const localFsPath = join(OUTPUT_DIR, `${rackId}.png`)

  if (existsSync(localFsPath)) {
    return { downloaded: false }
  }

  const response = await fetch(`https://api.minaryganar.com/assets/rollercoin/racks/game/${rackId}.png`)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  mkdirSync(OUTPUT_DIR, { recursive: true })
  writeFileSync(localFsPath, buffer)
  return { downloaded: true }
}

async function main() {
  const racksJson = JSON.parse(readFileSync(RACKS_JSON_PATH, 'utf-8'))
  const rackIds = racksJson.racks.map((r) => r.rackId)

  console.log(`sincronizando sprites "game" de ${rackIds.length} racks...`)

  let downloadedCount = 0
  let alreadyExistingCount = 0
  let failedCount = 0
  const failedIds = []

  for (const rackId of rackIds) {
    try {
      const { downloaded } = await downloadSprite(rackId)
      if (downloaded) {
        downloadedCount++
        await sleep(DOWNLOAD_DELAY_MS)
      } else {
        alreadyExistingCount++
      }
    } catch (err) {
      console.error(`falha ao baixar ${rackId}: ${err.message}`)
      failedCount++
      failedIds.push(rackId)
    }
  }

  console.log('')
  console.log('--- resumo ---')
  console.log(`total: ${rackIds.length}`)
  console.log(`baixados agora: ${downloadedCount}`)
  console.log(`já existentes: ${alreadyExistingCount}`)
  if (failedCount > 0) {
    console.log(`falharam (sem sprite "game" público -- vão cair no fallback de recorte-por-alfa): ${failedCount}`)
    for (const id of failedIds) console.log(`  - ${id}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
