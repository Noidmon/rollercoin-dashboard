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
import SimRackModal from '../components/SimRackModal'
import { roomConfigToRackPlacements } from '../utils/roomLayout'
import { computeRemainingInventory } from '../utils/simRoom'
import { useMinersInventoryImport, type EnrichedMinerEntry } from '../hooks/useMinersInventoryImport'
import { useAutoOptimizer, type LiveOptimizerSummary, type RoomTab } from '../hooks/useAutoOptimizer'
import type { PlayerData } from '../context/PlayerContext'
import type { OptimizerMode, OptimizerPriority } from '../utils/autoOptimizer'
import type { SimRoomState } from '../utils/simRoom'

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
// (SmartRoom, Prompt 65). Prompt 69: as DUAS sempre clicáveis desde o
// início -- a sala simulada agora existe desde o carregamento da página
// (clone do room-config real, editável manualmente mesmo sem rodar o
// Auto-Otimizador), não é mais um byproduct que só existe depois de um
// resultado.
function RoomTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: RoomTab
  onTabChange: (tab: RoomTab) => void
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
        onClick={() => onTabChange('simulacao')}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          activeTab === 'simulacao'
            ? 'bg-indigo-600 text-white'
            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
        }`}
      >
        ✨ Simulação
      </button>
    </div>
  )
}

interface OpenRack {
  rackInstanceId: string
  focusedMinerInstanceId: string | null
}

// Visual real da sala: fundo (RoomBackground) + racks/mineradores reais da
// conta (RoomRacksLayer) sobrepostos no mesmo container, escalado pra
// largura real disponível (ScaledRoomCanvas). Botões 1-4 na lateral trocam
// qual sala é exibida -- só uma por vez. Aba "Simulação" agora renderiza
// simRoom (racks E miners, Prompt 69) -- pode diferir da "Atual" tanto em
// QUEM está montado quanto em QUAIS racks existem (Desmontar Rack).
function RoomVisualization({
  playerData,
  pasteText,
  onPasteTextChange,
  onImport,
  unrecognizedCount,
  recognizedCount,
  optimizer,
  liveSummary,
  activeTab,
  onTabChange,
  simRoom,
  inventory,
  onSwapMiner,
  onRemoveMiner,
  onDismountRackMiners,
  onDismountRack,
  onResetSimulation,
}: {
  playerData: PlayerData
  pasteText: string
  onPasteTextChange: (value: string) => void
  onImport: () => void
  unrecognizedCount: number | null
  recognizedCount: number
  optimizer: OptimizerControlsProps
  liveSummary: LiveOptimizerSummary
  activeTab: RoomTab
  onTabChange: (tab: RoomTab) => void
  simRoom: SimRoomState
  inventory: EnrichedMinerEntry[]
  onSwapMiner: (rackInstanceId: string, x: 0 | 1, y: number, entry: EnrichedMinerEntry) => void
  onRemoveMiner: (rackInstanceId: string, x: 0 | 1, y: number) => void
  onDismountRackMiners: (rackInstanceId: string) => void
  onDismountRack: (rackInstanceId: string) => void
  onResetSimulation: () => void
}) {
  const realPlacements = roomConfigToRackPlacements(playerData.roomConfig)
  const unlockedLevels = new Set(realPlacements.map((p) => p.roomLevel))

  const [selectedLevel, setSelectedLevel] = useState(() => Math.min(...unlockedLevels, 0))
  const [openRack, setOpenRack] = useState<OpenRack | null>(null)

  if (unlockedLevels.size === 0) {
    return (
      <Card title="Sala">
        <p className="text-sm text-slate-400">Nenhum rack encontrado no room-config desta conta.</p>
      </Card>
    )
  }

  const showingSimulation = activeTab === 'simulacao'
  // Aba "Atual" sempre mostra o room-config REAL, intocado -- aba
  // "Simulação" mostra simRoom (racks + miners), que já começa como um
  // clone exato do real e diverge só depois de editar/otimizar.
  const simPlacements = roomConfigToRackPlacements({ racks: simRoom.racks })
  const racksInSelectedLevel = (showingSimulation ? simPlacements : realPlacements).filter(
    (p) => p.roomLevel === selectedLevel,
  )
  const displayMiners = showingSimulation ? simRoom.miners : playerData.roomConfig.miners

  const remainingByEntryKey = computeRemainingInventory(simRoom.miners, inventory)

  function handleRackClick(rackInstanceId: string, focusedMinerInstanceId: string | null) {
    setOpenRack({ rackInstanceId, focusedMinerInstanceId })
  }

  // Se a rack aberta no modal for desmontada (some do layout), navega pra
  // a próxima disponível na mesma sala em vez de deixar o modal "preso"
  // apontando pra uma rack que não existe mais -- fecha se não sobrar
  // nenhuma.
  function handleDismountRack(rackInstanceId: string) {
    onDismountRack(rackInstanceId)
    setOpenRack((prev) => {
      if (!prev || prev.rackInstanceId !== rackInstanceId) return prev
      const remaining = racksInSelectedLevel.filter((r) => r.instanceId !== rackInstanceId)
      return remaining.length > 0 ? { rackInstanceId: remaining[0].instanceId, focusedMinerInstanceId: null } : null
    })
  }

  function handleResetSimulation() {
    if (!window.confirm('Resetar a simulação? Isso descarta TODAS as edições manuais e o resultado do Auto-Otimizador, voltando ao estado real da conta.')) {
      return
    }
    setOpenRack(null)
    onResetSimulation()
  }

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
          <div className="flex items-center justify-between gap-2">
            <RoomTabs activeTab={activeTab} onTabChange={onTabChange} />
            <button
              type="button"
              onClick={handleResetSimulation}
              className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700"
              title="Descarta edições manuais e o resultado do Auto-Otimizador, volta ao estado real"
            >
              ↺ Resetar Simulação
            </button>
          </div>

          {showingSimulation && (
            <p className="text-[11px] text-slate-500">
              Simulação local -- nada foi salvo. Aplique manualmente no jogo se quiser. Clique numa rack pra editar.
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
                <RoomRacksLayer
                  placements={racksInSelectedLevel}
                  miners={displayMiners}
                  onRackClick={showingSimulation ? handleRackClick : undefined}
                />
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

          <AutoOptimizerSummary summary={liveSummary} currentPowerWithTemp={playerData.current_power} />
        </div>
      </div>

      {openRack && (
        <SimRackModal
          racksInRoom={racksInSelectedLevel}
          rackInstanceId={openRack.rackInstanceId}
          racks={simRoom.racks}
          miners={simRoom.miners}
          focusedMinerInstanceId={openRack.focusedMinerInstanceId}
          inventory={inventory}
          remainingByEntryKey={remainingByEntryKey}
          onNavigate={(rackInstanceId) => setOpenRack({ rackInstanceId, focusedMinerInstanceId: null })}
          onClose={() => setOpenRack(null)}
          onSwap={onSwapMiner}
          onRemove={onRemoveMiner}
          onDismountMiners={onDismountRackMiners}
          onDismountRack={handleDismountRack}
        />
      )}
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
          liveSummary={optimizerState.liveSummary}
          activeTab={optimizerState.activeTab}
          onTabChange={optimizerState.setActiveTab}
          simRoom={optimizerState.simRoom}
          inventory={entries}
          onSwapMiner={optimizerState.swapMiner}
          onRemoveMiner={optimizerState.removeMiner}
          onDismountRackMiners={optimizerState.dismountRackMiners}
          onDismountRack={optimizerState.dismountRack}
          onResetSimulation={optimizerState.resetSimulation}
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
