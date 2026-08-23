import type { MinerMerge } from '../types/miner'
import { calculateRoomPower, sumUniqueMinerBonusPercent, type Miner as RoomMiner, type Rack } from './calculatePower'
import type { ResolvedRoomMinerInstance } from './matchMinersInventory'

export interface RoomMergeImpact {
  // false quando as requiredPreviousCount cópias do nível de origem não
  // estão todas fisicamente na sala (alguma só existe no inventário
  // colado/storage) -- nesse caso não dá pra simular a sala resultante.
  calculable: boolean
  deltaPower: number
  deltaPercent: number
}

const NOT_CALCULABLE: RoomMergeImpact = { calculable: false, deltaPower: 0, deltaPercent: 0 }

// Cor do badge de qualidade baseado no Impacto Real -- binário (diferente
// das 3 faixas de getRatioColor): verde quando o impacto é positivo
// confirmado, vermelho quando é zero ou negativo, cinza neutro quando não
// dá pra calcular (peças fora da sala) -- nunca força vermelho nem verde
// pra um caso que não temos como avaliar.
export function getRoomImpactColor(impact: RoomMergeImpact | undefined): string {
  if (!impact || !impact.calculable) return '#475569'
  return impact.deltaPower > 0 ? '#16A34A' : '#DC2626'
}

// Impacto real de UM merge específico na sala -- reaproveita o mesmo motor
// (calculateRoomPower + sumUniqueMinerBonusPercent) e o mesmo padrão
// baseline/simulado/delta já confirmados e usados pelo Simulador (o total
// absoluto de cada chamada diverge do max_power real por um erro
// sistemático da fórmula; só o DELTA entre as duas chamadas é confiável,
// porque esse erro se cancela na subtração -- nunca exibir os totais
// isolados).
export function computeRoomMergeImpact(
  minerId: string,
  currentLevel: number,
  requiredCopies: number,
  nextMerge: MinerMerge,
  roomMiners: RoomMiner[],
  resolvedRoomInstances: ResolvedRoomMinerInstance[],
  roomRacks: Rack[],
  gamesPower: number,
  accountBonusPercent: number,
  maxPower: number,
): RoomMergeImpact {
  const sourceInstances = resolvedRoomInstances.filter(
    (r) => r.minerId === minerId && r.matchedLevel === currentLevel,
  )
  if (sourceInstances.length < requiredCopies) return NOT_CALCULABLE

  // Cópias consumidas -- as N primeiras na ordem em que aparecem em
  // room-config (ordem estável/determinística, sem critério de escolha
  // adicional). Se estiverem em racks diferentes, o rack usado pra
  // posicionar o resultado do merge é o da PRIMEIRA instância consumida
  // (decisão de produto explícita, documentada aqui).
  const consumed = sourceInstances.slice(0, requiredCopies)
  const consumedSet = new Set(consumed.map((c) => c.instance))
  const remainingMiners = roomMiners.filter((m) => !consumedSet.has(m))
  const resultRackId = consumed[0].instance.placement?.user_rack_id ?? null

  // bonus_percent de room-config vem em centésimos de % (ex: 800 = 8.00%,
  // confirmado contra miners.json em investigação anterior), enquanto
  // MinerMerge.bonus (miners.json, catálogo de terceiro) vem em % puro (ex:
  // 8 = 8%) -- por isso o ×100 abaixo, senão o bônus da peça simulada
  // ficaria 100x menor que o real.
  const simulatedMiners: RoomMiner[] = [
    ...remainingMiners,
    {
      miner_id: nextMerge.mergeId,
      power: nextMerge.power,
      bonus_percent: nextMerge.bonus * 100,
      placement: { user_rack_id: resultRackId },
    },
  ]

  const baselineCalc = calculateRoomPower(roomMiners, roomRacks, gamesPower, accountBonusPercent, 0)

  const realRoomBonusPercent = sumUniqueMinerBonusPercent(roomMiners)
  const externalFixedBonusPercent = accountBonusPercent - realRoomBonusPercent
  const simulatedRoomBonusPercent = sumUniqueMinerBonusPercent(simulatedMiners)
  const simulatedBonusPercent = simulatedRoomBonusPercent + externalFixedBonusPercent

  const simulatedCalc = calculateRoomPower(
    simulatedMiners,
    roomRacks,
    gamesPower,
    simulatedBonusPercent,
    0,
  )

  const deltaPower = simulatedCalc.total - baselineCalc.total
  const deltaPercent = maxPower > 0 ? (deltaPower / maxPower) * 100 : 0

  return { calculable: true, deltaPower, deltaPercent }
}
