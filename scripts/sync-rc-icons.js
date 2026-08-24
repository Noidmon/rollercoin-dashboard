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

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ICONS_DIR = join(ROOT, 'public', 'rc-icons')
const MINERS_ICONS_DIR = join(ROOT, 'public', 'miners-icons')
const MANIFEST_PATH = join(ROOT, 'src', 'data', 'assetManifest.ts')

// 'miner'/'merge' incluídos aqui como rede de segurança pra eventos
// futuros -- mas ícone de minerador (rollercoin/miners/*.gif) normalmente
// já existe em public/miners-icons/, baixado por sync-miners-data.js
// (pipeline separado, único source of truth pros +1600 mineradores). Ver
// tryReuseMinerIcon() abaixo: NUNCA baixa de novo pra rc-icons/ se o
// arquivo já existir lá -- evita duplicar o mesmo ícone em dois diretórios.
const SYNCED_REFERENCE_TYPES = new Set(['special', 'item', 'rack', 'miner', 'merge'])

// Se imagePath for um ícone de minerador (rollercoin/miners/{arquivo}) e
// esse arquivo já existir em public/miners-icons/ (baixado por
// sync-miners-data.js), reaproveita ele direto -- sem baixar de novo, sem
// duplicar arquivo. Retorna o caminho local (pra registrar no manifest) ou
// null se não for um caminho de minerador ou o arquivo ainda não existir
// lá (caso de minerador novo ainda não sincronizado -- cai no download
// normal pra rc-icons/ como último recurso).
function tryReuseMinerIcon(imagePath) {
  if (!imagePath.startsWith('rollercoin/miners/')) return null
  const filename = basename(imagePath)
  if (!existsSync(join(MINERS_ICONS_DIR, filename))) return null
  return `/miners-icons/${filename}`
}

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
  // level_legacy: usado pra merges nível 7+ (ou type "old_merge"/"legacy")
  // em vez de um level_7.webp que não existe -- confirmado com curl
  // (level_7 dá 404, level_legacy dá 200). level_set: selo adicional
  // (offset ao lado do selo de nível) quando o minerador está num set
  // ativo (`is_in_set` no room-config). Ambos usados no selo de nível da
  // sala (Simulador, Fase B) -- ver Lt() documentado em
  // docs/room-layout-investigation.md.
  'rollercoin/levels/level_legacy.webp',
  'rollercoin/levels/level_set.webp',
  'rollercoin/icons/sellable_disabled.webp',
  'rollercoin/icons/merge_enabled.webp',
  // Ícones de peça de merge (fan/wire/hashboard) x 5 raridades -- confirmado
  // via DevTools/Network em minaryganar.com que são 15 arquivos distintos,
  // não um ícone único colorido via CSS.
  'rollercoin/parts/fan_common.webp',
  'rollercoin/parts/fan_uncommon.webp',
  'rollercoin/parts/fan_rare.webp',
  'rollercoin/parts/fan_epic.webp',
  'rollercoin/parts/fan_legendary.webp',
  'rollercoin/parts/wire_common.webp',
  'rollercoin/parts/wire_uncommon.webp',
  'rollercoin/parts/wire_rare.webp',
  'rollercoin/parts/wire_epic.webp',
  'rollercoin/parts/wire_legendary.webp',
  'rollercoin/parts/hashboard_common.webp',
  'rollercoin/parts/hashboard_uncommon.webp',
  'rollercoin/parts/hashboard_rare.webp',
  'rollercoin/parts/hashboard_epic.webp',
  'rollercoin/parts/hashboard_legendary.webp',
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
  let reusedFromMinersIconsCount = 0
  let failedCount = 0

  for (const imagePath of imagePaths) {
    if (manifest[imagePath]) {
      console.log(`já sincronizado: ${imagePath}`)
      alreadySyncedCount++
      continue
    }

    const reused = tryReuseMinerIcon(imagePath)
    if (reused) {
      manifest[imagePath] = reused
      console.log(`reaproveitado de miners-icons/: ${imagePath} -> ${reused}`)
      reusedFromMinersIconsCount++
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
  console.log(`reaproveitados de miners-icons/ (sem baixar de novo): ${reusedFromMinersIconsCount}`)
  if (failedCount > 0) console.log(`falharam: ${failedCount}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
