import { useEffect, useState } from 'react'
import type { Miner } from '../utils/calculatePower'
import { matchRoomMinerInstances } from '../utils/matchMinersInventory'
import type { MinersData } from '../types/miner'
import {
  minerPixelBoxInRack,
  RACK_BOX_HEIGHT_PX,
  RACK_BOX_WIDTH_PX,
  type RackPlacement,
} from '../utils/roomLayout'

interface RackCatalogEntry {
  rackId: string
  image: string | null
}

interface RacksJson {
  racks: RackCatalogEntry[]
}

interface RoomRacksLayerProps {
  placements: RackPlacement[]
  miners: Miner[]
}

export default function RoomRacksLayer({ placements, miners }: RoomRacksLayerProps) {
  // Catálogos estáticos (public/data/racks.json e public/data/miners.json,
  // já sincronizados em sessões anteriores) -- só resolvem a IMAGEM de cada
  // tipo de rack/minerador, não são dado do jogador. Buscar isso aqui não
  // viola "não busca API sozinho": esse aviso é sobre o room-config real
  // (que precisa vir via prop `placements`/`miners`, já extraído por
  // roomConfigToRackPlacements), não sobre catálogos estáticos do app.
  const [rackImageById, setRackImageById] = useState<Map<string, string | null> | null>(null)
  const [minersData, setMinersData] = useState<MinersData | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/data/racks.json')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json()
      })
      .then((json: RacksJson) => {
        if (cancelled) return
        setRackImageById(new Map(json.racks.map((r) => [r.rackId, r.image])))
      })
      .catch(() => {
        if (!cancelled) setRackImageById(new Map())
      })

    fetch('/data/miners.json')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json()
      })
      .then((json: MinersData) => {
        if (!cancelled) setMinersData(json)
      })
      .catch(() => {
        if (!cancelled) setMinersData({ generatedAt: '', total: 0, totalMerges: 0, miners: [] })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const minersByRackInstance = new Map<string, Miner[]>()
  for (const miner of miners) {
    const rackInstanceId = miner.placement?.user_rack_id
    if (!rackInstanceId) continue
    const list = minersByRackInstance.get(rackInstanceId) ?? []
    list.push(miner)
    minersByRackInstance.set(rackInstanceId, list)
  }

  // Imagem do minerador NÃO pode vir de `miner.filename` direto -- o
  // room-config usa um formato de nome de arquivo que diverge do arquivo
  // realmente sincronizado em vários casos (apóstrofos e "&" no nome viram
  // slugs diferentes -- ex: filename "uncles_dungeon" no room-config vs
  // "uncle_s_dungeon.gif" de fato baixado). Confirmado com dado real: 15 de
  // 161 mineradores da NoID quebravam usando essa abordagem ingênua.
  // Reaproveita matchRoomMinerInstances (já usado em /merges) que casa por
  // NOME normalizado + POWER contra miners.json, evitando essa
  // inconsistência de slug por completo.
  const imageByInstanceId = new Map<string, string | null>()
  if (minersData) {
    const catalogById = new Map(minersData.miners.map((m) => [m.id, m]))
    for (const resolved of matchRoomMinerInstances(miners, minersData.miners)) {
      const instanceId = resolved.instance._id
      if (!instanceId) continue
      imageByInstanceId.set(instanceId, catalogById.get(resolved.minerId)?.image ?? null)
    }
  }

  return (
    <>
      {placements.map((placement) => {
        // Sem posição confirmada em cellToPixel() -- pula em vez de
        // inventar uma posição aproximada (ver comentário em
        // src/data/cellToPixel.ts).
        if (!placement.pixelPosition) {
          console.warn(
            `RoomRacksLayer: sem posição pixel confirmada pra rack ${placement.name} (roomLevel=${placement.roomLevel}, x=${placement.x}, y=${placement.y}) -- rack não renderizado.`,
          )
          return null
        }

        const rackImage = placement.rackId ? (rackImageById?.get(placement.rackId) ?? null) : null
        const rackMiners = minersByRackInstance.get(placement.instanceId) ?? []

        return (
          <div
            key={placement.instanceId}
            className="absolute"
            style={{
              left: placement.pixelPosition.left,
              top: placement.pixelPosition.top,
              width: RACK_BOX_WIDTH_PX,
              height: RACK_BOX_HEIGHT_PX,
            }}
            title={placement.name}
          >
            {rackImage && (
              <img
                src={rackImage}
                alt={placement.name}
                className="pointer-events-none absolute h-full w-full select-none object-contain"
              />
            )}

            {rackMiners.map((miner, index) => {
              const { placement: minerPlacement, width } = miner
              if (minerPlacement?.x === undefined || minerPlacement?.y === undefined || width === undefined) {
                return null
              }

              const box = minerPixelBoxInRack(placement.heightCells, {
                x: minerPlacement.x,
                y: minerPlacement.y,
                width,
                frameWidth: miner.frames_data?.frame_width,
                frameHeight: miner.frames_data?.frame_height,
              })

              const minerImageUrl = miner._id ? (imageByInstanceId.get(miner._id) ?? null) : null

              return (
                <div
                  key={miner._id ?? index}
                  className="pointer-events-none absolute"
                  style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
                  title={miner.name}
                >
                  {minerImageUrl && (
                    <img
                      src={minerImageUrl}
                      alt={miner.name ?? ''}
                      className="h-full w-full select-none object-contain [image-rendering:pixelated]"
                    />
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </>
  )
}
