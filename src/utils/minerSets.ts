// Bônus de coleção por SET temático (ex: "The Lost Treasure Set") --
// investigado no Prompt 66 pra fechar o gap entre o bonus_percent REAL da
// conta (API user-power-data, 331393 centésimos = 3313.93%) e o que
// sumUniqueMinerBonusPercent (calculatePower.ts, dedup por tipo/nível de
// minerador) calculava sozinho (316393 = 3163.93%).
//
// Fonte do dado: room-config NÃO expõe o set em si (só um booleano
// `is_in_set` por minerador, sem nome/tier/membros -- confirmado checando
// a resposta crua, sem campo "sets"/"active_sets"/"collection_sets" em
// lugar nenhum). O catálogo completo (nome do set, membros exigidos por
// nível, valor de recompensa por nível) vem de um endpoint NÃO documentado
// do Minar y Ganar, achado por tentativa: api.minaryganar.com/api/public/miner-sets
// (200 com header Referer; sets/collections/active-sets/user-sets/
// collection-sets deram 404 -- só esse existe). Sincronizado por
// scripts/sync-miner-sets-data.js pra public/data/miner-sets.json, mesmo
// padrão dos outros catálogos estáticos do projeto.
//
// Fórmula confirmada EXATA contra dado real (não estimada): a conta NoID
// tem 4 mineradores com is_in_set=true pertencentes a "The Lost Treasure
// Set" (Wrongway Atlas, Manners & Mayhem, Drama Chest, Gilded Greed, todos
// room-config level=4 -- que bate com level+1=5 dos membros "lvl5" do set,
// confirmando a MESMA convenção 1-indexada já usada no selo de raridade,
// minerLevelBadges). O set tem 3 níveis: 2/3/4 membros exigem
// 20%/50%/80%. Com 4 membros distintos possuídos, os 3 níveis são
// satisfeitos SIMULTANEAMENTE -- e a recompensa é CUMULATIVA (soma de
// TODOS os níveis alcançados, não só o mais alto): 20+50+80=150.00%,
// exatos 15000 centésimos -- que bate BIT A BIT com o gap real
// (331393-316393=15000, zero resíduo). Essa é a validação, não uma
// suposição.
//
// LIMITAÇÃO DOCUMENTADA (não resolvida aqui): alguns sets têm
// reward_type "power_ghs" (bônus de poder FIXO em Gh/s, ex: "Beer Pack
// Set" +5.000.000 Gh/s) em vez de "bonus_percent" -- um mecanismo
// estruturalmente diferente (aditivo direto ao poder, não multiplicativo
// via bonusPercent). A conta NoID não tem nenhum set desse tipo ativo,
// então não há dado real pra validar essa fórmula -- por isso só o tipo
// "bonus_percent" é somado aqui. getUnmodeledPowerSets() abaixo expõe
// quais sets "power_ghs" estão satisfeitos, sem aplicar nada, pra não
// inventar uma fórmula não confirmada.
export interface MinerSetLevel {
  level: number
  requiredCount: number
  rewardValue: number
}

export interface MinerSetMember {
  name: string
  level: number
}

export interface MinerSet {
  id: number
  name: string
  rewardType: string
  levels: MinerSetLevel[]
  members: MinerSetMember[]
}

export interface MinerSetsData {
  generatedAt: string
  total: number
  sets: MinerSet[]
}

interface RoomMinerLike {
  name?: string
  level?: number
}

// Nível EXIBIDO (1-indexado) do minerador -- mesma conversão já confirmada
// em minerLevelBadges (roomLayout.ts): room-config guarda `level` como
// número de merges feitos (0-indexed), o nível de raridade/set usa +1.
function displayLevel(miner: RoomMinerLike): number {
  return (miner.level ?? 0) + 1
}

function buildOwnedNameLevelKeys(miners: RoomMinerLike[]): Set<string> {
  const keys = new Set<string>()
  for (const m of miners) {
    if (!m.name) continue
    keys.add(`${m.name}|${displayLevel(m)}`)
  }
  return keys
}

// Um "membro" do set é satisfeito se o jogador possui QUALQUER cópia numa
// das variantes de nível listadas pra esse nome (ex: "Wrongway Atlas"
// conta tanto no nível 5 quanto no 6 -- confirmado contra os dados reais,
// ambos aparecem na lista de membros do mesmo set).
function distinctMemberNames(set: MinerSet): string[] {
  return [...new Set(set.members.map((m) => m.name))]
}

function isMemberOwned(name: string, set: MinerSet, ownedKeys: Set<string>): boolean {
  return set.members.some((m) => m.name === name && ownedKeys.has(`${m.name}|${m.level}`))
}

// Soma o bônus de TODOS os sets "bonus_percent" que o jogador satisfaz,
// em centésimos de % (mesma convenção de bonus_percent/sumUniqueMinerBonusPercent)
// -- cumulativo por nível (ver comentário do arquivo, confirmado contra
// dado real). Pronto pra somar direto ao resultado de
// sumUniqueMinerBonusPercent (ver sumRoomBonusPercentWithSets abaixo).
export function computeSetBonusPercentCentesimos(miners: RoomMinerLike[], setsData: MinerSetsData): number {
  const ownedKeys = buildOwnedNameLevelKeys(miners)
  let totalCentesimos = 0

  for (const set of setsData.sets) {
    if (set.rewardType !== 'bonus_percent') continue

    const names = distinctMemberNames(set)
    const satisfiedCount = names.filter((name) => isMemberOwned(name, set, ownedKeys)).length

    for (const lvl of set.levels) {
      if (satisfiedCount >= lvl.requiredCount) {
        totalCentesimos += lvl.rewardValue * 100
      }
    }
  }

  return totalCentesimos
}

// Fato ESTÁTICO de catálogo (independe de tier satisfeito): esse nome de
// minerador é membro de ALGUM set? Equivalente ao booleano `is_in_set` que
// room-config expõe por minerador real -- usado pra reconstruir o mesmo
// selo visual (level_set.webp) pra mineradores vindos do INVENTÁRIO
// colado, que não têm `is_in_set` próprio (só existe em objetos reais de
// room-config).
export function isNameInAnySet(name: string, setsData: MinerSetsData): boolean {
  return setsData.sets.some((set) => set.members.some((m) => m.name === name))
}

// Sets "power_ghs" satisfeitos, só pra visibilidade/log -- NÃO aplicado em
// lugar nenhum do cálculo (ver limitação documentada no topo do arquivo).
export function getUnmodeledPowerSets(
  miners: RoomMinerLike[],
  setsData: MinerSetsData,
): { name: string; achievedPowerGhs: number }[] {
  const ownedKeys = buildOwnedNameLevelKeys(miners)
  const result: { name: string; achievedPowerGhs: number }[] = []

  for (const set of setsData.sets) {
    if (set.rewardType !== 'power_ghs') continue

    const names = distinctMemberNames(set)
    const satisfiedCount = names.filter((name) => isMemberOwned(name, set, ownedKeys)).length

    let achievedPowerGhs = 0
    for (const lvl of set.levels) {
      if (satisfiedCount >= lvl.requiredCount) achievedPowerGhs += lvl.rewardValue
    }
    if (achievedPowerGhs > 0) result.push({ name: set.name, achievedPowerGhs })
  }

  return result
}

// INVESTIGAÇÃO (segunda rodada): catálogo atual (public/data/miner-sets.json,
// 17 sets) tem 6 sets "power_ghs" -- não é caso hipotético, existem de
// verdade: Beer Pack Set (2/3 membros -> +5.000.000/+8.000.000 Gh/s),
// Bronze Farm Set (2/4 -> +1.500.000/+2.500.000), Globes Set (2/4 ->
// +10.000.000/+25.000.000), Power-Up Set (2/3 -> +5.000.000/+10.000.000),
// Silver Farm Set (2/4 -> +2.000.000/+3.000.000), Super Bros Set (2/3 ->
// +7.500.000/+15.000.000). Todos os membros desses 6 sets são nível 1
// (base, sem merge) -- diferente do Lost Treasure Set (bonus_percent, que
// exigia nível 5/6).
//
// NENHUMA conta real disponível tem um desses sets ativo (NoID não possui
// nenhum dos mineradores membros) -- então a fórmula abaixo (mesma lógica
// de contagem de membros distintos + cumulativo por tier já confirmada pra
// bonus_percent, só que somando Gh/s FIXO em vez de %) é uma EXTRAPOLAÇÃO
// não validada contra dado real, não uma fórmula confirmada.
//
// Por isso NÃO é chamada de lugar nenhum do app (Auto-Otimizador, Merges,
// Dashboard) -- fica disponível só como função separada, pra quem quiser
// testar manualmente ou plugar quando surgir uma conta real com esse tipo
// de set pra validar. Ver getUnmodeledPowerSets() acima pro detalhamento
// por set (usado por esta função).
export function computeUnvalidatedSetPowerGhsBonus(miners: RoomMinerLike[], setsData: MinerSetsData): number {
  return getUnmodeledPowerSets(miners, setsData).reduce((sum, s) => sum + s.achievedPowerGhs, 0)
}
