// Sincroniza os assets de fundo da sala (skin fixo "default", o mesmo usado
// pelos sites de referência ariel-ruiz e Minar y Ganar) pra
// public/room-background/. Mesmo padrão idempotente dos outros scripts de
// sync (pula arquivo já baixado).
//
// Uso:
//   node scripts/sync-room-background.js
//
// appearanceId FIXO (não é o da conta do usuário) -- confirmado via
// investigação de docs/room-layout-investigation.md: esse é o skin cujo
// array de posições (Ur/Ze) já foi extraído e verificado do bundle JS do
// simulador de sala do minaryganar.com. Trocar esse ID exige re-extrair as
// posições também (achados de skins diferentes têm imagens com dimensões
// diferentes -- não são intercambiáveis).
const APPEARANCE_ID = '60770a4665dce86c866dd720'
const ROOM_FOLDER = 'room3_done'

// Arquivos únicos referenciados em Ur (Sala 0) + Ze (Salas 1-3) + a "janela"
// (essentials/scy.png, compartilhada por todas as salas) + os 24 tiles de
// slot vazio (room_pc pra Sala 0, room_else pras Salas 1-3) -- lista
// completa transcrita de docs/room-layout-investigation.md.
const ASSET_PATHS = [
  // Sala 0 (Ur)
  'decore1.png',
  'decore1_light.png',
  'decore2.png',
  'decore3.png',
  'decore4.png',
  'decore5.png',
  'decore6.png',
  'decore7.png',
  'decore8.png',
  'decore9.png',
  'decore10.png',
  'essentials/trophy_shelf.png',
  'essentials/chair.png',
  'essentials/Table.png',
  // Salas 1-3 (Ze)
  'decore11.png',
  'decore12.png',
  'decore13.png',
  'decore14.png',
  'decore15.png',
  // Janela, compartilhada
  'essentials/scy.png',
  // Tiles de slot vazio
  ...Array.from({ length: 12 }, (_, i) => `room_pc/${String(i + 1).padStart(2, '0')}.png`),
  ...Array.from({ length: 12 }, (_, i) => `room_else/${String(i + 1).padStart(2, '0')}.png`),
]

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUTPUT_DIR = join(ROOT, 'public', 'room-background')

const BASE_URL = `https://api.minaryganar.com/assets/rollercoin/room-backgrounds/${APPEARANCE_ID}/${ROOM_FOLDER}`
const DOWNLOAD_DELAY_MS = 50

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// NÃO usar basename() aqui -- room_pc/05.png e room_else/05.png têm o MESMO
// basename ("05.png") mas são arquivos DIFERENTES (tiles de Sala 0 vs Salas
// 1-3). Achatar por basename causava colisão silenciosa: room_else/*.png
// nunca era baixado de verdade, ficava "já existente" por causa dos
// room_pc/*.png homônimos baixados antes. Substitui "/" por "_" pra manter
// os dois conjuntos de 12 arquivos distintos no mesmo diretório flat.
function flattenAssetPath(assetPath) {
  return assetPath.replace(/\//g, '_')
}

async function downloadAsset(assetPath) {
  const filename = flattenAssetPath(assetPath)
  const localFsPath = join(OUTPUT_DIR, filename)

  if (existsSync(localFsPath)) {
    return { filename, downloaded: false }
  }

  const response = await fetch(`${BASE_URL}/${assetPath}`)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  mkdirSync(OUTPUT_DIR, { recursive: true })
  writeFileSync(localFsPath, buffer)
  return { filename, downloaded: true }
}

async function main() {
  console.log(`sincronizando ${ASSET_PATHS.length} assets de fundo de sala...`)

  let downloadedCount = 0
  let alreadyExistingCount = 0
  let failedCount = 0

  for (const assetPath of ASSET_PATHS) {
    try {
      const { filename, downloaded } = await downloadAsset(assetPath)
      if (downloaded) {
        console.log(`baixado: ${assetPath} -> ${filename}`)
        downloadedCount++
        await sleep(DOWNLOAD_DELAY_MS)
      } else {
        console.log(`já existente: ${filename}`)
        alreadyExistingCount++
      }
    } catch (err) {
      console.error(`falha ao baixar ${assetPath}: ${err.message}`)
      failedCount++
    }
  }

  console.log('')
  console.log('--- resumo ---')
  console.log(`total: ${ASSET_PATHS.length}`)
  console.log(`baixados agora: ${downloadedCount}`)
  console.log(`já existentes: ${alreadyExistingCount}`)
  if (failedCount > 0) console.log(`falharam: ${failedCount}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
