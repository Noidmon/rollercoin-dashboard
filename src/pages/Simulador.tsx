import { useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { getLeagueInfo, proxyImageUrl } from '../data/leagues'
import { formatPower } from '../utils/formatPower'
import Card from '../components/Card'
import RoomBackground from '../components/RoomBackground'
import RoomRacksLayer from '../components/RoomRacksLayer'
import RoomInventoryPanel from '../components/RoomInventoryPanel'
import InventoryPasteField from '../components/InventoryPasteField'
import AutoOptimizerControls from '../components/AutoOptimizerControls'
import AutoOptimizerSummary from '../components/AutoOptimizerSummary'
import AutoOptimizerResults from '../components/AutoOptimizerResults'
import ScaledRoomCanvas from '../components/ScaledRoomCanvas'
import LeagueBadge from '../components/LeagueBadge'
import { roomConfigToRackPlacements } from '../utils/roomLayout'
import { useMinersInventoryImport } from '../hooks/useMinersInventoryImport'
import { useAutoOptimizer, type RoomTab } from '../hooks/useAutoOptimizer'
import type { PlayerData } from '../context/PlayerContext'
import type { AutoOptimizerResult, OptimizerMode, OptimizerPriority } from '../utils/autoOptimizer'

interface OptimizerControlsProps {
  priority: OptimizerPriority
  setPriority: (v: OptimizerPriority) => void
  mode: OptimizerMode
  setMode: (v: OptimizerMode) => void
  leagueIndex: number
  setLeagueIndex: (v: number) => void
  runOptimizer: () => void
  disabled: boolean
}

// A RollerCoin permite até 4 salas por conta (níveis 0-3) -- os 4 botões
// aparecem sempre, mesmo pras salas que a conta ainda não desbloqueou
// (ficam desabilitadas, sem dado real pra mostrar).
const ROOM_LEVELS = [0, 1, 2, 3]

// Painel de stats ao lado da sala -- mesmos dados já exibidos no Dashboard
// (poder atual, progresso de liga), reaproveitados aqui em vez de
// recalculados. O Auto-Otimizador NÃO fica mais aqui (Prompt 65) -- foi
// pro lado direito da sala, ao lado do visual (ver AutoOptimizerControls em
// RoomVisualization). Só o campo de colar inventário continua neste painel.
function RoomStatsPanel({
  playerData,
  pasteText,
  onPasteTextChange,
  onImport,
  unrecognizedCount,
  recognizedCount,
}: {
  playerData: PlayerData
  pasteText: string
  onPasteTextChange: (value: string) => void
  onImport: () => void
  unrecognizedCount: number | null
  recognizedCount: number
}) {
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

      <InventoryPasteField
        pasteText={pasteText}
        onPasteTextChange={onPasteTextChange}
        onImport={onImport}
        unrecognizedCount={unrecognizedCount}
        recognizedCount={recognizedCount}
      />
    </div>
  )
}

// Abas "Atual"/"Simulação" acima da sala visual -- referência real
// (SmartRoom, Prompt 65). "Simulação" só fica clicável depois de rodar o
// Auto-Otimizador ao menos uma vez (sem resultado ainda, não tem o que
// mostrar).
function RoomTabs({
  activeTab,
  onTabChange,
  hasResult,
}: {
  activeTab: RoomTab
  onTabChange: (tab: RoomTab) => void
  hasResult: boolean
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onTabChange('atual')}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          activeTab === 'atual'
            ? 'bg-indigo-600 text-white'
            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
        }`}
      >
        📌 Atual
      </button>
      <button
        type="button"
        onClick={() => hasResult && onTabChange('simulacao')}
        disabled={!hasResult}
        title={hasResult ? undefined : 'Rode o Auto-Otimizador primeiro'}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          !hasResult
            ? 'cursor-not-allowed bg-slate-800/60 text-slate-600'
            : activeTab === 'simulacao'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
        }`}
      >
        ✨ Simulação
      </button>
    </div>
  )
}

// Visual real da sala: fundo (RoomBackground) + racks/mineradores reais da
// conta (RoomRacksLayer) sobrepostos no mesmo container, escalado pra
// largura real disponível (ScaledRoomCanvas). Botões 1-4 na lateral trocam
// qual sala é exibida -- só uma por vez. Aba "Simulação" troca só os
// MINERS renderizados (result.simulatedMiners) -- os racks nunca mudam de
// posição, só quem está posicionado neles.
function RoomVisualization({
  playerData,
  pasteText,
  onPasteTextChange,
  onImport,
  unrecognizedCount,
  recognizedCount,
  optimizer,
  result,
  activeTab,
  onTabChange,
}: {
  playerData: PlayerData
  pasteText: string
  onPasteTextChange: (value: string) => void
  onImport: () => void
  unrecognizedCount: number | null
  recognizedCount: number
  optimizer: OptimizerControlsProps
  result: AutoOptimizerResult | null
  activeTab: RoomTab
  onTabChange: (tab: RoomTab) => void
}) {
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
  const showingSimulation = activeTab === 'simulacao' && result !== null
  const displayMiners = showingSimulation ? result!.simulatedMiners : playerData.roomConfig.miners

  return (
    <Card title="Sala">
      <div className="flex flex-col gap-6 lg:flex-row">
        <RoomStatsPanel
          playerData={playerData}
          pasteText={pasteText}
          onPasteTextChange={onPasteTextChange}
          onImport={onImport}
          unrecognizedCount={unrecognizedCount}
          recognizedCount={recognizedCount}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <RoomTabs activeTab={activeTab} onTabChange={onTabChange} hasResult={result !== null} />

          {showingSimulation && (
            <p className="text-[11px] text-slate-500">
              Simulação local -- nada foi salvo. Aplique manualmente no jogo se quiser.
            </p>
          )}

          <div className="flex items-start gap-3">
            <div className="flex shrink-0 flex-col gap-2">
              {ROOM_LEVELS.map((level) => {
                const unlocked = unlockedLevels.has(level)
                return (
                  <button
                    key={level}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => setSelectedLevel(level)}
                    title={unlocked ? `Sala ${level + 1}` : 'Sala não desbloqueada'}
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
                Sala {selectedLevel + 1} ({racksInSelectedLevel.length} racks)
              </p>
              <ScaledRoomCanvas>
                <RoomBackground roomLevel={selectedLevel} />
                <RoomRacksLayer placements={racksInSelectedLevel} miners={displayMiners} />
              </ScaledRoomCanvas>
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-64">
          <AutoOptimizerControls
            priority={optimizer.priority}
            onPriorityChange={optimizer.setPriority}
            mode={optimizer.mode}
            onModeChange={optimizer.setMode}
            leagueIndex={optimizer.leagueIndex}
            onLeagueIndexChange={optimizer.setLeagueIndex}
            onOptimize={optimizer.runOptimizer}
            disabled={optimizer.disabled}
          />

          {result && <AutoOptimizerSummary result={result} currentPowerWithTemp={playerData.current_power} />}
        </div>
      </div>
    </Card>
  )
}

function SimuladorContent({ playerData }: { playerData: PlayerData }) {
  const { pasteText, setPasteText, entries, unrecognizedCount, handleImport } =
    useMinersInventoryImport()
  const optimizerState = useAutoOptimizer(playerData, entries)

  const optimizer: OptimizerControlsProps = {
    priority: optimizerState.priority,
    setPriority: optimizerState.setPriority,
    mode: optimizerState.mode,
    setMode: optimizerState.setMode,
    leagueIndex: optimizerState.leagueIndex,
    setLeagueIndex: optimizerState.setLeagueIndex,
    runOptimizer: optimizerState.runOptimizer,
    disabled: entries.length === 0,
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Simulador</h1>

      <div className="mt-4">
        <RoomVisualization
          playerData={playerData}
          pasteText={pasteText}
          onPasteTextChange={setPasteText}
          onImport={handleImport}
          unrecognizedCount={unrecognizedCount}
          recognizedCount={entries.length}
          optimizer={optimizer}
          result={optimizerState.result}
          activeTab={optimizerState.activeTab}
          onTabChange={optimizerState.setActiveTab}
        />
      </div>

      <AutoOptimizerResults result={optimizerState.result} />

      <RoomInventoryPanel entries={entries} />
    </div>
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

  return <SimuladorContent playerData={playerData} />
}
