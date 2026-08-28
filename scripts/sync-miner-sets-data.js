// Sincroniza o catálogo de "sets" temáticos de minerador (bônus de coleção
// por conjunto, ex: "The Lost Treasure Set") da API pública do Minar y
// Ganar pra public/data/miner-sets.json. Reutilizável -- roda de novo
// quando quiser atualizar (sempre reescreve do zero a partir da API, sem
// imagem pra baixar aqui -- member.image_path não é usado, o selo visual
// já vem de outro lugar, ver minerLevelBadges em roomLayout.ts).
//
// Uso:
//   node scripts/sync-miner-sets-data.js
//
// Fonte: https://api.minaryganar.com/api/public/miner-sets -- endpoint
// NÃO documentado, descoberto por tentativa (Prompt 66) sondando nomes
// plausíveis (sets/collections/active-sets/etc, todos 404) até achar esse
// (200, exige header Referer). Devolve tudo numa página só (confirmado:
// total=17, items.length=17, sem paginação).
//
// Confirmado com dado real (conta NoID, Prompt 66): bonus_percent real da
// conta (API user-power-data) = 331393 (centésimos), sumUniqueMinerBonusPercent
// (dedup por tipo/nível, sem sets) = 316393 -- gap de EXATOS 15000
// centésimos (150.00%), que bate EXATO com "The Lost Treasure Set" nível 3
// (20+50+80=150, cumulativo -- soma de TODOS os tiers alcançados, não só o
// mais alto) -- ver src/utils/minerSets.ts pra fórmula completa.

import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJsonIfChanged } from './lib/writeJsonIfChanged.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA_DIR = join(ROOT, 'public', 'data')
const OUTPUT_PATH = join(DATA_DIR, 'miner-sets.json')

const API_URL = 'https://api.minaryganar.com/api/public/miner-sets'
const REFERER = 'https://minaryganar.com/'

function normalizeSet(raw) {
  return {
    id: raw.id,
    name: raw.name,
    rewardType: raw.reward_type,
    levels: raw.levels.map((lvl) => ({
      level: lvl.level,
      requiredCount: lvl.required_count,
      rewardValue: Number(lvl.reward_value),
    })),
    // Só nome+nível -- é o suficiente pra casar contra room-config
    // (miner.name + miner.level+1, confirmado que usa a mesma numeração
    // 1-indexada do selo de raridade -- ver minerLevelBadges).
    members: raw.members.map((m) => ({ name: m.name, level: m.level })),
  }
}

async function main() {
  console.log('buscando catálogo de sets...')
  const response = await fetch(API_URL, { headers: { Referer: REFERER } })
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  const data = await response.json()
  console.log(`${data.items.length} sets buscados (API reporta total=${data.total})`)

  const sets = data.items.map(normalizeSet)
  const output = { generatedAt: new Date().toISOString(), total: data.total, sets }

  mkdirSync(DATA_DIR, { recursive: true })
  const { written } = writeJsonIfChanged(OUTPUT_PATH, output, { space: 2 })

  const rewardTypes = [...new Set(sets.map((s) => s.rewardType))]
  console.log('')
  console.log('--- resumo ---')
  console.log(`sets processados: ${sets.length}`)
  console.log(`tipos de recompensa encontrados: ${rewardTypes.join(', ')}`)
  console.log(
    written
      ? `miner-sets.json salvo em ${OUTPUT_PATH} (reescrito -- catálogo mudou)`
      : `miner-sets.json: sem mudança real -- generatedAt antigo mantido, arquivo intocado`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
