import { useEffect, useState } from 'react'
import type { Miner } from '../utils/calculatePower'
import { matchRoomMinerInstances } from '../utils/matchMinersInventory'
import type { MinersData } from '../types/miner'
import { getRackImageMetrics, type RackImageMetrics } from '../utils/rackTrimBox'
import {
  minerPixelBoxInRack,
  rackGameSpriteBox,
  rackImageRenderBox,
  rackPixelBox,
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

// Caminho PRIMÁRIO: sprite "game" (public/racks-game-icons/{rackId}.png,
// sincronizado por scripts/sync-rack-game-sprites.js) -- já vem na
// proporção certa por número de linhas, sem precisar de recorte por canal
// alfa. É um spritesheet de 2 estados lado a lado (normal | selecionado);
// só usamos o primeiro (normal), recortado via o wrapper com
// overflow:hidden abaixo. Se essa imagem falhar (rack raro sem sprite
// "game" público), cai no FALLBACK: recorte por canal alfa sobre o
// catálogo .webp (rackTrimBox.ts) -- mesma estrutura de fallback
// confirmada no bundle real (`Zn`/`gameFailed`).
function RackImage({
  rackId,
  fallbackSrc,
  alt,
}: {
  rackId: string | undefined
  fallbackSrc: string | null
  alt: string
}) {
  const gameSpriteUrl = rackId ? `/racks-game-icons/${rackId}.png` : null

  const [gameSpriteFailed, setGameSpriteFailed] = useState(false)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [trimMetrics, setTrimMetrics] = useState<RackImageMetrics | null>(null)

  useEffect(() => {
    setGameSpriteFailed(false)
    setNaturalSize(null)
  }, [gameSpriteUrl])

  useEffect(() => {
    if (!gameSpriteFailed || !fallbackSrc) return
    let cancelled = false
    getRackImageMetrics(fallbackSrc).then((m) => {
      if (!cancelled) setTrimMetrics(m)
    })
    return () => {
      cancelled = true
    }
  }, [gameSpriteFailed, fallbackSrc])

  if (gameSpriteUrl && !gameSpriteFailed) {
    const box = naturalSize ? rackGameSpriteBox(naturalSize.width, naturalSize.height) : null
    return (
      <div
        className="pointer-events-none absolute overflow-hidden"
        style={
          box
            ? { left: box.left, top: box.top, width: box.frameWidth, height: box.frameHeight }
            : { width: 0, height: 0 }
        }
      >
        <img
          src={gameSpriteUrl}
          alt={alt}
          onLoad={(e) =>
            setNaturalSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
          }
          onError={() => setGameSpriteFailed(true)}
          // max-w-none: o preflight do Tailwind aplica `img{max-width:100%}`
          // por padrão -- sem isso, o <img> ficava CAPADO na largura do
          // wrapper (75px) mesmo com width:150px inline, espremendo os 2
          // estados do spritesheet (normal+selecionado) visualmente juntos
          // dentro da caixa (bug real, confirmado via getBoundingClientRect
          // com dado real: width relatado 75 quando o style dizia 150).
          className="absolute left-0 top-0 max-w-none select-none [image-rendering:pixelated]"
          style={box ? { width: box.frameWidth * 2, height: box.frameHeight } : undefined}
        />
      </div>
    )
  }

  // Fallback -- não renderiza nada até ter as métricas reais (evita mostrar
  // no tamanho/posição errados por um instante e "pular" pro certo).
  if (!fallbackSrc || !trimMetrics) return null

  const box = rackImageRenderBox(trimMetrics)

  return (
    <img
      src={fallbackSrc}
      alt={alt}
      className="pointer-events-none absolute max-w-none select-none [image-rendering:pixelated]"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    />
  )
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
        const box = rackPixelBox(placement.pixelPosition)

        return (
          <div
            key={placement.instanceId}
            // overflow-hidden + relative: a imagem do rack é desenhada no
            // tamanho NATURAL escalado (rackImageRenderBox), que costuma
            // extrapolar a caixa 75x120 -- o corte visual pelo container é
            // proposital (mesmo comportamento confirmado no bundle real).
            className="absolute overflow-hidden"
            style={{
              left: box.left,
              top: box.top,
              width: RACK_BOX_WIDTH_PX,
              height: RACK_BOX_HEIGHT_PX,
              // Racks mais "pra frente" na sala (top maior) ficam por cima
              // dos mais "pra trás" -- mesmo critério de profundidade usado
              // na função de render real (zIndex baseado no top do slot).
              zIndex: Math.round(placement.pixelPosition.top),
            }}
            title={placement.name}
          >
            <RackImage rackId={placement.rackId} fallbackSrc={rackImage} alt={placement.name} />

            {rackMiners.map((miner, index) => {
              const { placement: minerPlacement, width } = miner
              if (minerPlacement?.x === undefined || minerPlacement?.y === undefined || width === undefined) {
                return null
              }

              const box = minerPixelBoxInRack(placement.heightCells, {
                x: minerPlacement.x,
                y: minerPlacement.y,
                width,
                frameHeight: miner.frames_data?.frame_height,
              })

              const minerImageUrl = miner._id ? (imageByInstanceId.get(miner._id) ?? null) : null
              if (!minerImageUrl) return null

              return (
                <img
                  key={miner._id ?? index}
                  src={minerImageUrl}
                  alt={miner.name ?? ''}
                  title={miner.name}
                  // Altura NÃO é fixada -- fica "auto" (proporção natural do
                  // .gif) e translateY(-100%) ancora pela base, exatamente
                  // como a função real (`eo`, branch de fallback GIF) faz.
                  // Fixar largura+altura como antes achatava/esticava
                  // miners com proporções diferentes da suposta 116x50.
                  className="pointer-events-none absolute max-w-none select-none [image-rendering:pixelated]"
                  style={{ left: box.left, top: box.top, width: box.width, transform: 'translateY(-100%)' }}
                />
              )
            })}
          </div>
        )
      })}
    </>
  )
}
