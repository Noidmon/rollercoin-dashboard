// Sincroniza ícones de reward (special/item/rack) + imagens do evento, e os
// assets fixos de UI (FIXED_UI_ASSETS, sempre), de api.minaryganar.com pra
// public/rc-icons/, atualizando src/data/assetManifest.ts.
//
// Uso:
//   node scripts/sync-rc-icons.js caminho/para/evento.json
//   cat evento.json | node scripts/sync-rc-icons.js
//   node scripts/sync-rc-icons.js   (sem evento -- só sincroniza os fixos)
//
// Reusável -- roda de novo sempre que um evento novo tiver ícones ainda não
// sincronizados. Mesmo padrão a ser reaproveitado pros +8000 mineradores no
// futuro (manifesto + script de sync, não R2).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ICONS_DIR = join(ROOT, 'public', 'rc-icons')
const MANIFEST_PATH = join(ROOT, 'src', 'data', 'assetManifest.ts')

const SYNCED_REFERENCE_TYPES = new Set(['special', 'item', 'rack'])

// Assets fixos de UI -- não são "recompensas" de nenhum evento específico, são
// elementos visuais reaproveitados em qualquer merge/minerador (selo de nível,
// ícone de "não vendável"). Sempre garantidos, independente do JSON de evento.
const FIXED_UI_ASSETS = [
  'rollercoin/levels/level_1.webp',
  'rollercoin/levels/level_2.webp',
  'rollercoin/levels/level_3.webp',
  'rollercoin/levels/level_4.webp',
  'rollercoin/levels/level_5.webp',
  'rollercoin/levels/level_6.webp',
  'rollercoin/icons/sellable_disabled.webp',
  'rollercoin/icons/merge_enabled.webp',
]

const MANIFEST_HEADER = `// Mapeia image_path (caminho relativo, ex: "rollercoin/items/bonus_power_3.webp")
// para o caminho LOCAL em public/rc-icons/, depois de sincronizado.
// Preenchido manualmente via scripts/sync-rc-icons.js sempre que novos ícones aparecem.
// Reusar esse MESMO padrão (manifesto + script de sync) quando formos baixar
// os +8000 mineradores no futuro -- não usar R2 pra isso, só public/ como aqui.

export const ASSET_MANIFEST: Record<string, string> = {
`

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf-8')
}

function collectImagePaths(event) {
  const paths = new Set()

  for (const reward of event.rewards ?? []) {
    if (SYNCED_REFERENCE_TYPES.has(reward.reference_type) && reward.image_path) {
      paths.add(reward.image_path)
    }
  }

  if (event.cover_image_path) paths.add(event.cover_image_path)
  if (event.promotional_image_path) paths.add(event.promotional_image_path)

  return [...paths]
}

function parseExistingManifest(text) {
  const manifest = {}
  const entryPattern = /^\s*"([^"]+)":\s*"([^"]+)",?\s*$/
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('//')) continue
    const match = entryPattern.exec(line)
    if (match) manifest[match[1]] = match[2]
  }
  return manifest
}

function writeManifest(manifest) {
  const entries = Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))
  const body = entries.map(([key, value]) => `  "${key}": "${value}",`).join('\n')
  const content = `${MANIFEST_HEADER}${body}${entries.length > 0 ? '\n' : ''}}\n`
  writeFileSync(MANIFEST_PATH, content, 'utf-8')
}

async function downloadIcon(imagePath) {
  const url = `https://api.minaryganar.com/assets/${imagePath}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  const filename = basename(imagePath)
  mkdirSync(ICONS_DIR, { recursive: true })
  writeFileSync(join(ICONS_DIR, filename), buffer)
  return `/rc-icons/${filename}`
}

async function main() {
  const filePath = process.argv[2]

  let eventImagePaths = []
  if (filePath) {
    const raw = readFileSync(filePath, 'utf-8')
    eventImagePaths = collectImagePaths(JSON.parse(raw))
  } else if (!process.stdin.isTTY) {
    const raw = await readStdin()
    if (raw.trim()) {
      eventImagePaths = collectImagePaths(JSON.parse(raw))
    }
  }
  // sem argumento de arquivo e sem stdin redirecionado: só sincroniza os
  // FIXED_UI_ASSETS abaixo, sem exigir um JSON de evento.

  const imagePaths = [...new Set([...eventImagePaths, ...FIXED_UI_ASSETS])]

  const existingManifestText = readFileSync(MANIFEST_PATH, 'utf-8')
  const manifest = parseExistingManifest(existingManifestText)

  let downloadedCount = 0
  let alreadySyncedCount = 0
  let failedCount = 0

  for (const imagePath of imagePaths) {
    if (manifest[imagePath]) {
      console.log(`já sincronizado: ${imagePath}`)
      alreadySyncedCount++
      continue
    }

    try {
      const localPath = await downloadIcon(imagePath)
      manifest[imagePath] = localPath
      console.log(`baixado: ${imagePath} -> ${localPath}`)
      downloadedCount++
    } catch (err) {
      console.error(`falha ao baixar ${imagePath}: ${err.message}`)
      failedCount++
    }
  }

  writeManifest(manifest)

  console.log('')
  console.log('--- resumo ---')
  console.log(`baixados agora: ${downloadedCount}`)
  console.log(`já existentes: ${alreadySyncedCount}`)
  if (failedCount > 0) console.log(`falharam: ${failedCount}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
