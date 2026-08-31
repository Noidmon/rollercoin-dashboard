import { useEffect, useState } from 'react'
import type { Miner } from '../utils/calculatePower'
import { matchRoomMinerInstances } from '../utils/matchMinersInventory'
import { cellsAllowedForSlot, listRackSlots } from '../utils/simRoom'
import type { EnrichedMinerEntry } from '../hooks/useMinersInventoryImport'
import type { MinersData } from '../types/miner'
import { getRackImageMetrics, type RackImageMetrics } from '../utils/rackTrimBox'
import { resolveAssetUrl } from '../utils/resolveAssetUrl'
import { withBase, withImageBase, withCacheBust } from '../utils/withBase'
import {
  emptyCellPixelBox,
  minerLevelBadges,
  minerPixelBoxInRack,
  rackGameSpriteBox,
  rackImageRenderBox,
  rackPixelBox,
  MINER_BADGE_HEIGHT,
  MINER_BADGE_WIDTH,
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
  const gameSpriteUrl = rackId ? withBase(`/racks-game-icons/${rackId}.png`) : null

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
    // Wrapper de recorte PRÓPRIO (mesmo padrão do caminho "game sprite"
    // acima) -- antes dependia do overflow:hidden do slot pai pra cortar a
    // imagem escalada, mas isso também cortava miners que ultrapassam o
    // topo do slot (transform:translateY(-100%) pode empurrar a miner pra
    // cima de y=0). Cada caminho de imagem de rack agora recorta a si
    // mesmo, então o slot pai não precisa mais de overflow:hidden nenhum.
    <div
      className="pointer-events-none absolute overflow-hidden"
      style={{ left: 0, top: 0, width: RACK_BOX_WIDTH_PX, height: RACK_BOX_HEIGHT_PX }}
    >
      <img
        src={fallbackSrc}
        alt={alt}
        className="absolute max-w-none select-none [image-rendering:pixelated]"
        style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      />
    </div>
  )
}

interface RoomRacksLayerProps {
  placements: RackPlacement[]
  miners: Miner[]
  // Só definido na aba "Simulação" (Prompt 69) -- clicar numa rack ou num
  // minerador dentro dela abre o modal de edição focado ali. undefined na
  // aba "Atual" (view somente-leitura, sem handler nenhum) -- mais simples
  // que desabilitar cliques explicitamente, e o cursor/hover também some
  // sozinho sem essa prop.
  onRackClick?: (rackInstanceId: string, focusedMinerInstanceId: string | null) => void
  // Drag-and-drop do inventário (Prompt 73) -- mesma convenção de
  // "só definido na aba Simulação" acima. draggedEntry vem de um useState
  // em SimuladorContent (setado no onDragStart do card do inventário) --
  // não dá pra ler o VALOR de dataTransfer durante dragover em todo
  // navegador (só os tipos, por segurança), então o feedback visual (quais
  // células vazias destacam verde) precisa desse estado React, não do
  // dataTransfer nativo. onDropMiner reaproveita a MESMA operação de
  // preencher uma célula vazia já usada pelo modal (swapMiner).
  draggedEntry?: EnrichedMinerEntry | null
  onDropMiner?: (rackInstanceId: string, x: 0 | 1, y: number, entry: EnrichedMinerEntry) => void
}

export default function RoomRacksLayer({
  placements,
  miners,
  onRackClick,
  draggedEntry,
  onDropMiner,
}: RoomRacksLayerProps) {
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

    fetch(withCacheBust('/data/racks.json'))
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json()
      })
      .then((json: RacksJson) => {
        if (cancelled) return
        setRackImageById(new Map(json.racks.map((r) => [r.rackId, r.image ? withBase(r.image) : r.image])))
      })
      .catch(() => {
        if (!cancelled) setRackImageById(new Map())
      })

    fetch(withCacheBust('/data/miners.json'))
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json()
      })
      .then((json: MinersData) => {
        if (!cancelled) setMinersData({ ...json, miners: withImageBase(json.miners) })
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
            // SEM overflow-hidden aqui de propósito (Prompt 56): miners
            // ancoradas com transform:translateY(-100%) podem ultrapassar
            // o topo do slot (75x120) -- isso é esperado e correto (mesmo
            // comportamento do jogo real, miners "vazam" pra cima da
            // prateleira). Cada imagem de RACK já recorta a si mesma (ver
            // RackImage acima), então não precisa do slot cortar nada.
            className={`absolute${onRackClick ? ' cursor-pointer' : ''}`}
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
            onClick={onRackClick ? () => onRackClick(placement.instanceId, null) : undefined}
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

              // Selo de nível (e, se aplicável, de set) sobreposto no
              // minerador -- feature nunca portada pro visual da sala até
              // aqui (só existia no catálogo de /mineradores, contexto
              // diferente). Ver minerLevelBadges() em roomLayout.ts.
              const badges = minerLevelBadges(placement.heightCells, {
                x: minerPlacement.x,
                y: minerPlacement.y,
                width,
                frameWidth: miner.frames_data?.frame_width,
                frameHeight: miner.frames_data?.frame_height,
                type: miner.type,
                level: miner.level,
                isInSet: miner.is_in_set,
              })

              return (
                <div key={miner._id ?? index}>
                  <img
                    src={minerImageUrl}
                    alt={miner.name ?? ''}
                    title={miner.name}
                    // Altura NÃO é fixada -- fica "auto" (proporção natural do
                    // .gif) e translateY(-100%) ancora pela base, exatamente
                    // como a função real (`eo`, branch de fallback GIF) faz.
                    // Fixar largura+altura como antes achatava/esticava
                    // miners com proporções diferentes da suposta 116x50.
                    //
                    // pointer-events fica ativo só quando editável (Prompt
                    // 69) -- clicar no MINERADOR abre o modal já focado nele
                    // (stopPropagation pra não também disparar o onClick da
                    // rack inteira, que abriria sem foco nenhum).
                    className={`absolute max-w-none select-none [image-rendering:pixelated]${onRackClick ? ' cursor-pointer' : ' pointer-events-none'}`}
                    style={{ left: box.left, top: box.top, width: box.width, transform: 'translateY(-100%)' }}
                    onClick={
                      onRackClick
                        ? (e) => {
                            e.stopPropagation()
                            onRackClick(placement.instanceId, miner._id ?? null)
                          }
                        : undefined
                    }
                  />
                  {badges.map((badge) => (
                    <img
                      key={badge.asset}
                      src={resolveAssetUrl(badge.asset)}
                      alt={badge.alt}
                      className="pointer-events-none absolute max-w-none select-none [image-rendering:pixelated]"
                      style={{
                        left: badge.left,
                        top: badge.top,
                        width: MINER_BADGE_WIDTH,
                        height: MINER_BADGE_HEIGHT,
                      }}
                    />
                  ))}
                </div>
              )
            })}

            {onDropMiner &&
              (() => {
                const slots = listRackSlots(rackMiners, placement.instanceId, placement.heightCells)
                return slots
                  .filter((slot) => !slot.occupant)
                  .map((slot) => {
                    const cellsAllowed = cellsAllowedForSlot(slots, slot)
                    const isCompatible = !!draggedEntry && (cellsAllowed === 'any' || draggedEntry.cells === 1)
                    const cellBox = emptyCellPixelBox(placement.heightCells, { x: slot.x, y: slot.y, width: 1 })
                    return (
                      <div
                        key={`empty-${slot.x}-${slot.y}`}
                        data-empty-cell={`${placement.instanceId}:${slot.x}:${slot.y}`}
                        className={`absolute rounded transition-colors ${
                          isCompatible
                            ? 'border-2 border-emerald-400 bg-emerald-400/25'
                            : draggedEntry
                              ? 'border border-dashed border-slate-600/40'
                              : ''
                        }`}
                        style={{ left: cellBox.left, top: cellBox.top, width: cellBox.width, height: cellBox.height }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = isCompatible ? 'copy' : 'none'
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (!draggedEntry || !isCompatible) return
                          onDropMiner(placement.instanceId, slot.x, slot.y, draggedEntry)
                        }}
                      />
                    )
                  })
              })()}
          </div>
        )
      })}
    </>
  )
}
