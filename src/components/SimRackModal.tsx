import { useEffect, useMemo, useState } from 'react'
import type { Miner as RoomMinerInstance, Rack } from '../utils/calculatePower'
import type { RackPlacement } from '../utils/roomLayout'
import type { EnrichedMinerEntry } from '../hooks/useMinersInventoryImport'
import { listRackSlots, type RackSlotView } from '../utils/simRoom'
import { matchRoomMinerInstances } from '../utils/matchMinersInventory'
import { formatPower } from '../utils/formatPower'
import type { MinersData } from '../types/miner'

// Modal de detalhe/edição de UMA rack na aba "Simulação" (Prompt 69) --
// referência visual real fornecida pelo usuário (screenshot: nome+bônus no
// topo, setas de navegação entre racks, minerador em destaque à esquerda +
// lista "MINERS MONTADOS" à direita, Desmontar Miners/Desmontar Rack no
// rodapé).
//
// DECISÃO DE UX (não 100% especificada no pedido): a referência mostra uma
// prévia da rack inteira (miniatura com todos os miners já montados) no
// lado esquerdo. Implementei em vez disso uma imagem GRANDE só do slot em
// FOCO (clicar numa linha da lista muda o foco e a imagem) -- evita
// duplicar toda a lógica de posicionamento pixel-a-pixel de
// RoomRacksLayer/roomLayout.ts (pensada pra a sala inteira, não pra um
// preview isolado) só pra esse modal, e ainda reaproveita o MESMO sprite
// resolvido (mesma fonte de imagem, só maior) como pedido.
function formatRackBonus(bonusCentesimos: number): string {
  const pct = bonusCentesimos / 100
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(2)}%`
}

function slotKey(x: 0 | 1, y: number): string {
  return `${x}-${y}`
}

interface SwapPickerProps {
  cellsAllowed: 1 | 2 | 'any'
  inventory: EnrichedMinerEntry[]
  remainingByEntryKey: Map<string, number>
  onPick: (entry: EnrichedMinerEntry) => void
  onClose: () => void
}

function SwapPicker({ cellsAllowed, inventory, remainingByEntryKey, onPick, onClose }: SwapPickerProps) {
  const [search, setSearch] = useState('')

  const options = inventory.filter((entry) => {
    if (cellsAllowed !== 'any' && entry.cells !== cellsAllowed) return false
    if ((remainingByEntryKey.get(entry.key) ?? 0) <= 0) return false
    if (search.trim() && !entry.name.toLowerCase().includes(search.trim().toLowerCase())) return false
    return true
  })

  return (
    <div className="absolute inset-0 z-10 flex flex-col rounded-lg bg-slate-950/95 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <input
          autoFocus
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar no inventário..."
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto">
        {options.length === 0 ? (
          <p className="p-2 text-xs text-slate-500">Nenhum minerador disponível no inventário pra esse slot.</p>
        ) : (
          options.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => onPick(entry)}
              className="flex w-full items-center gap-2 rounded-md bg-slate-900 px-2 py-1.5 text-left hover:bg-slate-800"
            >
              {entry.image ? (
                <img src={entry.image} alt="" className="h-8 w-8 shrink-0 object-contain" />
              ) : (
                <span className="h-8 w-8 shrink-0" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-white">{entry.name}</span>
                <span className="block text-[11px] text-slate-400">
                  {formatPower(entry.power)} | {entry.bonus}% · restam {remainingByEntryKey.get(entry.key) ?? 0}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

interface SlotRowProps {
  slot: RackSlotView
  isFeatured: boolean
  imageUrl: string | null
  onFeature: () => void
  onSwapClick: () => void
  onRemove: () => void
  swapPickerOpen: boolean
  swapPicker: React.ReactNode
}

function SlotRow({ slot, isFeatured, imageUrl, onFeature, onSwapClick, onRemove, swapPickerOpen, swapPicker }: SlotRowProps) {
  return (
    <div className="relative">
      <div
        onClick={onFeature}
        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
          isFeatured ? 'border-indigo-500 bg-indigo-950/40' : 'border-slate-700 bg-slate-800/60 hover:bg-slate-800'
        }`}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-900">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-lg text-slate-700">—</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {slot.occupant ? (
            <>
              <p className="truncate text-sm font-semibold text-white">{slot.occupant.name}</p>
              <p className="text-xs text-slate-400">
                {formatPower(slot.occupant.power)} | {((slot.occupant.bonus_percent ?? 0) / 100).toFixed(0)}%
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">Vazio</p>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSwapClick()
          }}
          title="Trocar"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm text-white hover:bg-indigo-500"
        >
          ↻
        </button>
        {slot.occupant && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            title="Remover"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm text-white hover:bg-red-500"
          >
            ✕
          </button>
        )}
      </div>
      {swapPickerOpen && swapPicker}
    </div>
  )
}

export interface SimRackModalProps {
  racksInRoom: RackPlacement[]
  rackInstanceId: string
  racks: Rack[]
  miners: RoomMinerInstance[]
  focusedMinerInstanceId: string | null
  inventory: EnrichedMinerEntry[]
  remainingByEntryKey: Map<string, number>
  onNavigate: (rackInstanceId: string) => void
  onClose: () => void
  onSwap: (rackInstanceId: string, x: 0 | 1, y: number, entry: EnrichedMinerEntry) => void
  onRemove: (rackInstanceId: string, x: 0 | 1, y: number) => void
  onDismountMiners: (rackInstanceId: string) => void
  onDismountRack: (rackInstanceId: string) => void
}

export default function SimRackModal({
  racksInRoom,
  rackInstanceId,
  racks,
  miners,
  focusedMinerInstanceId,
  inventory,
  remainingByEntryKey,
  onNavigate,
  onClose,
  onSwap,
  onRemove,
  onDismountMiners,
  onDismountRack,
}: SimRackModalProps) {
  const [minersData, setMinersData] = useState<MinersData | null>(null)
  const [featuredKey, setFeaturedKey] = useState<string | null>(null)
  const [swapPickerKey, setSwapPickerKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/data/miners.json')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json() as Promise<MinersData>
      })
      .then((json) => {
        if (!cancelled) setMinersData(json)
      })
      .catch(() => {
        if (!cancelled) setMinersData({ generatedAt: '', total: 0, totalMerges: 0, miners: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const rackIndex = racksInRoom.findIndex((r) => r.instanceId === rackInstanceId)
  const rack = racksInRoom[rackIndex]
  const rackData = racks.find((r) => r._id === rackInstanceId)

  const rackMiners = useMemo(
    () => miners.filter((m) => m.placement?.user_rack_id === rackInstanceId),
    [miners, rackInstanceId],
  )
  const slots = useMemo(
    () => (rack ? listRackSlots(miners, rackInstanceId, rack.heightCells) : []),
    [miners, rackInstanceId, rack],
  )

  const imageByInstanceId = useMemo(() => {
    const map = new Map<string, string | null>()
    if (!minersData) return map
    const catalogById = new Map(minersData.miners.map((m) => [m.id, m]))
    for (const resolved of matchRoomMinerInstances(rackMiners, minersData.miners)) {
      if (!resolved.instance._id) continue
      map.set(resolved.instance._id, catalogById.get(resolved.minerId)?.image ?? null)
    }
    return map
  }, [rackMiners, minersData])

  // Foco inicial: o minerador clicado (se veio de um clique em cima dele),
  // senão o primeiro slot ocupado, senão o primeiro slot (vazio).
  useEffect(() => {
    if (!rack) return
    if (focusedMinerInstanceId) {
      const found = slots.find((s) => s.occupant?._id === focusedMinerInstanceId)
      if (found) {
        setFeaturedKey(slotKey(found.x, found.y))
        return
      }
    }
    const firstOccupied = slots.find((s) => s.occupant)
    setFeaturedKey(slotKey((firstOccupied ?? slots[0])?.x ?? 0, (firstOccupied ?? slots[0])?.y ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rackInstanceId])

  // Fecha o seletor de troca se o slot que ele estava editando deixou de
  // existir (ex: rack trocou via ◀▶ enquanto o seletor de outro slot
  // estava aberto).
  useEffect(() => {
    setSwapPickerKey((prev) => (prev && !slots.some((s) => slotKey(s.x, s.y) === prev) ? null : prev))
  }, [slots])

  if (!rack) return null

  const featured = slots.find((s) => slotKey(s.x, s.y) === featuredKey) ?? slots[0]
  const featuredImage = featured?.occupant?._id ? (imageByInstanceId.get(featured.occupant._id) ?? null) : null

  function goPrev() {
    const prevIndex = (rackIndex - 1 + racksInRoom.length) % racksInRoom.length
    onNavigate(racksInRoom[prevIndex].instanceId)
  }
  function goNext() {
    const nextIndex = (rackIndex + 1) % racksInRoom.length
    onNavigate(racksInRoom[nextIndex].instanceId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold uppercase tracking-wide text-white" title={rack.name}>
              {rack.name}
            </h2>
            <p className="text-xs text-slate-400">Bônus do rack {formatRackBonus(rackData?.bonus ?? 0)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={goPrev}
              disabled={racksInRoom.length <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={racksInRoom.length <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ›
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-700"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-1 gap-4 overflow-y-auto p-4">
          <div className="flex w-40 shrink-0 flex-col items-center gap-2">
            <div className="relative flex h-32 w-32 items-center justify-center rounded-lg border border-slate-700 bg-slate-950">
              {featuredImage ? (
                <img src={featuredImage} alt="" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-3xl text-slate-700">—</span>
              )}
            </div>
            <p className="max-w-full truncate text-center text-xs font-medium text-slate-200">
              {featured?.occupant?.name ?? 'Slot vazio'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => featured && setSwapPickerKey(slotKey(featured.x, featured.y))}
                title="Trocar"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-500"
              >
                ↻
              </button>
              {featured?.occupant && (
                <button
                  type="button"
                  onClick={() => onRemove(rackInstanceId, featured.x, featured.y)}
                  title="Remover"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-500"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Miners Montados</p>
            <div className="space-y-2">
              {slots.map((slot) => {
                const key = slotKey(slot.x, slot.y)
                const imageUrl = slot.occupant?._id ? (imageByInstanceId.get(slot.occupant._id) ?? null) : null
                return (
                  <SlotRow
                    key={key}
                    slot={slot}
                    isFeatured={key === featuredKey}
                    imageUrl={imageUrl}
                    onFeature={() => setFeaturedKey(key)}
                    onSwapClick={() => setSwapPickerKey(key)}
                    onRemove={() => onRemove(rackInstanceId, slot.x, slot.y)}
                    swapPickerOpen={swapPickerKey === key}
                    swapPicker={
                      <SwapPicker
                        cellsAllowed={slot.spansBothX ? 'any' : 1}
                        inventory={inventory}
                        remainingByEntryKey={remainingByEntryKey}
                        onPick={(entry) => {
                          onSwap(rackInstanceId, slot.x, slot.y, entry)
                          setSwapPickerKey(null)
                        }}
                        onClose={() => setSwapPickerKey(null)}
                      />
                    }
                  />
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-800 bg-slate-950/40 px-4 py-3">
          <button
            type="button"
            onClick={() => onDismountMiners(rackInstanceId)}
            className="flex-1 rounded-md bg-slate-700 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-slate-600"
          >
            Desmontar Miners
          </button>
          <button
            type="button"
            onClick={() => onDismountRack(rackInstanceId)}
            className="flex-1 rounded-md bg-red-700 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-red-600"
          >
            Desmontar Rack
          </button>
        </div>
      </div>
    </div>
  )
}
