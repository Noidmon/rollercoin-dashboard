import { useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { getLeagueInfo, proxyImageUrl } from '../data/leagues'
import { formatPower } from '../utils/formatPower'
import Card from '../components/Card'
import RoomBackground from '../components/RoomBackground'
import RoomRacksLayer from '../components/RoomRacksLayer'
import ScaledRoomCanvas from '../components/ScaledRoomCanvas'
import LeagueBadge from '../components/LeagueBadge'
import { roomConfigToRackPlacements } from '../utils/roomLayout'
import type { PlayerData } from '../context/PlayerContext'

// A RollerCoin permite até 4 salas por conta (níveis 0-3) -- os 4 botões
// aparecem sempre, mesmo pras salas que a conta ainda não desbloqueou
// (ficam desabilitadas, sem dado real pra mostrar).
const ROOM_LEVELS = [0, 1, 2, 3]

// Painel de stats ao lado da sala -- mesmos dados já exibidos no Dashboard
// (poder atual, progresso de liga), reaproveitados aqui em vez de
// recalculados, seguindo a composição da referência (painel + sala lado a
// lado, não cards separados empilhados).
function RoomStatsPanel({ playerData }: { playerData: PlayerData }) {
  const { currentLeague, nextLeague, powerNeeded, progressPercent } = getLeagueInfo(
    playerData.max_power,
  )
  const currentLeagueImageUrl = proxyImageUrl(playerData.currentLeagueImageUrl)

  return (
    <div className="flex w-full shrink-0 flex-col gap-4 lg:w-56">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Poder Atual</p>
        <p className="text-2xl font-bold text-emerald-400">{formatPower(playerData.max_power)}</p>
      </div>

      <div>
        <p className="text-xs text-slate-400">
          {nextLeague
            ? `Faltam ${formatPower(powerNeeded)} pra próxima liga`
            : 'Liga máxima atingida!'}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <LeagueBadge src={currentLeagueImageUrl} size={40} active />
          <div className="flex-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-300">{currentLeague.name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-400">Mineradores</p>
          <p className="text-sm font-semibold text-slate-200">{formatPower(playerData.miners)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Bônus dos Racks</p>
          <p className="text-sm font-semibold text-slate-200">{formatPower(playerData.racks)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-slate-400">Bônus de Sets</p>
          <p className="text-sm font-semibold text-slate-200">
            {formatPower(playerData.bonus)} ({(playerData.bonus_percent / 100).toFixed(2)}%)
          </p>
        </div>
      </div>
    </div>
  )
}

// Visual real da sala: fundo (RoomBackground) + racks/mineradores reais da
// conta (RoomRacksLayer) sobrepostos no mesmo container, escalado pra
// largura real disponível (ScaledRoomCanvas). Botões 1-4 na lateral trocam
// qual sala é exibida -- só uma por vez.
function RoomVisualization({ playerData }: { playerData: PlayerData }) {
  const placements = roomConfigToRackPlacements(playerData.roomConfig)
  const unlockedLevels = new Set(placements.map((p) => p.roomLevel))

  const [selectedLevel, setSelectedLevel] = useState(() => Math.min(...unlockedLevels, 0))

  if (unlockedLevels.size === 0) {
    return (
      <Card title="Sala">
        <p className="text-sm text-slate-400">Nenhum rack encontrado no room-config desta conta.</p>
      </Card>
    )
  }

  const racksInSelectedLevel = placements.filter((p) => p.roomLevel === selectedLevel)

  return (
    <Card title="Sala">
      <div className="flex flex-col gap-6 lg:flex-row">
        <RoomStatsPanel playerData={playerData} />

        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex shrink-0 flex-col gap-2">
            {ROOM_LEVELS.map((level) => {
              const unlocked = unlockedLevels.has(level)
              return (
                <button
                  key={level}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => setSelectedLevel(level)}
                  title={unlocked ? `Sala ${level}` : 'Sala não desbloqueada'}
                  className={`flex h-10 w-10 items-center justify-center rounded-md border text-sm font-bold transition ${
                    !unlocked
                      ? 'cursor-not-allowed border-slate-800 text-slate-700'
                      : selectedLevel === level
                        ? 'border-indigo-400 bg-indigo-600 text-white'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {level + 1}
                </button>
              )
            })}
          </div>

          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs text-slate-400">
              Sala {selectedLevel} ({racksInSelectedLevel.length} racks)
            </p>
            <ScaledRoomCanvas>
              <RoomBackground roomLevel={selectedLevel} />
              <RoomRacksLayer placements={racksInSelectedLevel} miners={playerData.roomConfig.miners} />
            </ScaledRoomCanvas>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function Simulador() {
  const { playerData } = usePlayer()

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

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Simulador</h1>

      <div className="mt-4">
        <RoomVisualization playerData={playerData} />
      </div>
    </div>
  )
}
