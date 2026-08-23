import { useEffect, useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { calculateRoomPower, sumUniqueMinerBonusPercent } from '../utils/calculatePower'
import { getLeagueInfo } from '../data/leagues'
import { formatPower } from '../utils/formatPower'
import Card from '../components/Card'
import RoomBackground from '../components/RoomBackground'
import RoomRacksLayer from '../components/RoomRacksLayer'
import { roomConfigToRackPlacements } from '../utils/roomLayout'
import type { PlayerData } from '../context/PlayerContext'

// Visual real da sala: fundo (RoomBackground) + racks/mineradores reais da
// conta (RoomRacksLayer) sobrepostos no mesmo container 720x450. Uma seção
// por sala que a conta realmente tem desbloqueada (room_level 0, 1, 2...),
// nunca as duas composições lado a lado como no preview temporário anterior
// -- cada sala mostra só a composição (Sala 0 ou Salas 1-3) que bate com o
// room_level real dela.
function RoomVisualization({ roomConfig }: { roomConfig: PlayerData['roomConfig'] }) {
  const placements = roomConfigToRackPlacements(roomConfig)

  const roomLevels = [...new Set(placements.map((p) => p.roomLevel))].sort((a, b) => a - b)

  if (roomLevels.length === 0) {
    return (
      <Card title="Sala">
        <p className="text-sm text-slate-400">Nenhum rack encontrado no room-config desta conta.</p>
      </Card>
    )
  }

  return (
    <Card title="Sala">
      <div className="flex flex-wrap gap-4">
        {roomLevels.map((level) => (
          <div key={level}>
            <p className="mb-2 text-xs text-slate-400">
              Sala {level} ({placements.filter((p) => p.roomLevel === level).length} racks)
            </p>
            <div className="relative" style={{ width: 720, height: 450 }}>
              <RoomBackground roomLevel={level} />
              <RoomRacksLayer
                placements={placements.filter((p) => p.roomLevel === level)}
                miners={roomConfig.miners}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

interface SimMinerRow {
  id: string
  name?: string
  minerId?: string
  power: number
  bonusPercent: number
  rackId: string | null
}

export default function Simulador() {
  const { playerData } = usePlayer()
  const [miners, setMiners] = useState<SimMinerRow[]>([])

  useEffect(() => {
    if (!playerData) {
      setMiners([])
      return
    }

    setMiners(
      playerData.roomConfig.miners.map((miner, index) => ({
        id: miner._id ?? `miner-${index}`,
        name: miner.name,
        minerId: miner.miner_id,
        power: miner.power,
        bonusPercent: miner.bonus_percent ?? 0,
        rackId: miner.placement?.user_rack_id ?? null,
      })),
    )
  }, [playerData])

  if (!playerData) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Simulador</h1>
        <p className="mt-4 text-sm text-slate-400">
          Digite um nickname no menu lateral para começar.
        </p>
      </div>
    )
  }

  const racks = playerData.roomConfig.racks

  // O total do calculateRoomPower reflete a composição ATUAL da sala, que pode
  // divergir do max_power real (marca d'água histórica da RollerCoin). Por isso
  // usamos max_power como âncora e aplicamos só o delta calculado entre a
  // composição real e a simulada — o desvio da fórmula se cancela na subtração.
  const baselineCalc = calculateRoomPower(
    playerData.roomConfig.miners,
    racks,
    playerData.games,
    playerData.bonus_percent,
    0,
  )

  // bonus_percent da conta é composto de "bônus dinâmico da sala" (soma dos
  // bonus_percent únicos por tipo de minerador realmente equipado) + "bônus fixo
  // externo" (itens/reserva, fora da sala, não muda com a simulação).
  const realRoomBonusPercent = sumUniqueMinerBonusPercent(playerData.roomConfig.miners)
  const externalFixedBonusPercent = playerData.bonus_percent - realRoomBonusPercent

  const simulatedMinerObjects = miners.map((row) => ({
    power: row.power,
    placement: { user_rack_id: row.rackId },
    miner_id: row.minerId,
    bonus_percent: row.bonusPercent,
  }))

  const simulatedRoomBonusPercent = sumUniqueMinerBonusPercent(simulatedMinerObjects)
  const simulatedBonusPercent = simulatedRoomBonusPercent + externalFixedBonusPercent

  const simulatedCalc = calculateRoomPower(
    simulatedMinerObjects,
    racks,
    playerData.games,
    simulatedBonusPercent,
    0,
  )

  const delta = simulatedCalc.total - baselineCalc.total
  const currentTotal = playerData.max_power
  const simulatedTotal = playerData.max_power + delta
  const difference = delta

  const currentLeagueInfo = getLeagueInfo(currentTotal)
  const simulatedLeagueInfo = getLeagueInfo(simulatedTotal)
  const leagueChanged =
    simulatedLeagueInfo.currentLeague.name !== currentLeagueInfo.currentLeague.name

  function updateMiner(id: string, patch: Partial<SimMinerRow>) {
    setMiners((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function removeMiner(id: string) {
    setMiners((prev) => prev.filter((row) => row.id !== id))
  }

  function addMiner() {
    setMiners((prev) => [
      ...prev,
      { id: crypto.randomUUID(), power: 0, bonusPercent: 0, rackId: null },
    ])
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Simulador</h1>

      <div className="mt-4 space-y-4">
        <RoomVisualization roomConfig={playerData.roomConfig} />

        <Card title="Poder Permanente Atual">
          <p className="text-2xl font-bold text-white">{formatPower(currentTotal)}</p>
          <p className="mt-1 text-xs text-slate-500">
            (sem bônus temporário — o que conta para a liga)
          </p>
        </Card>

        <Card title="Comparativo">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-400">Poder atual</p>
              <p className="text-lg text-slate-200">{formatPower(currentTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Poder simulado</p>
              <p className="text-lg text-slate-200">{formatPower(simulatedTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Diferença</p>
              <p
                className={`text-lg font-semibold ${
                  difference > 0
                    ? 'text-emerald-400'
                    : difference < 0
                      ? 'text-red-400'
                      : 'text-slate-200'
                }`}
              >
                {difference >= 0 ? '+' : ''}
                {formatPower(difference)}
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-300">
            {leagueChanged
              ? `⚠️ Essa mudança faria você ${
                  simulatedTotal > currentTotal ? 'subir' : 'cair'
                } para ${simulatedLeagueInfo.currentLeague.name}!`
              : `Ainda dentro de ${simulatedLeagueInfo.currentLeague.name}.`}
          </p>
        </Card>

        <Card title="Simulação">
          <button
            onClick={addMiner}
            className="mb-4 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Adicionar minerador hipotético
          </button>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase text-slate-400">
                  <th className="py-2 pr-3 font-medium">Minerador</th>
                  <th className="py-2 pr-3 font-medium">Power</th>
                  <th className="py-2 pr-3 font-medium">Bônus %</th>
                  <th className="py-2 pr-3 font-medium">Rack</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {miners.map((row) => (
                  <tr key={row.id} className="border-b border-slate-800/60">
                    <td className="py-2 pr-3 text-slate-300">{row.name ?? row.id}</td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        value={row.power}
                        onChange={(e) =>
                          updateMiner(row.id, { power: Number(e.target.value) })
                        }
                        className="w-28 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        value={row.bonusPercent}
                        onChange={(e) =>
                          updateMiner(row.id, { bonusPercent: Number(e.target.value) })
                        }
                        className="w-24 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={row.rackId ?? ''}
                        onChange={(e) =>
                          updateMiner(row.id, { rackId: e.target.value || null })
                        }
                        className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Sem rack</option>
                        {racks.map((rack) => (
                          <option key={rack._id} value={rack._id}>
                            {`${rack.name ?? rack._id} (+${(rack.bonus / 100).toFixed(2)}%)`}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        onClick={() => removeMiner(row.id)}
                        className="rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
