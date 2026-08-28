import { useState } from 'react'
import { getMergeLevelColor } from '../utils/minerMergeCalculator'
import { resolveAssetUrl } from '../utils/resolveAssetUrl'

// Selos de nível/set reaproveitados em cards (Prompt 81) -- MESMOS assets e
// mesma regra de "nível máximo sem asset próprio" já confirmados na sala
// real (minerLevelBadges, roomLayout.ts): level_{N}.webp pra N<7,
// level_legacy.webp pra N>=7 (level_7.webp não existe no servidor de
// origem, 404 confirmado -- ver comentário em minerMergeCalculator.ts,
// LEVEL_COLORS). Diferente de minerLevelBadges (que calcula offset em
// PIXELS pra ancorar em cima de um sprite dentro de um rack da sala), aqui
// o layout é um flex-row simples no canto do card -- não precisa da
// matemática de posicionamento pixel-a-pixel, só empilhar os selos lado a
// lado com um gap pequeno.
//
// `level` já vem na convenção de RARIDADE do catálogo (0, 2, 3, 4, 5,
// 6... -- pula o "1", mesma convenção de merges[].level/matchedLevel),
// NÃO a convenção 0-indexada de "nº de merges" do room-config -- ao
// contrário de minerLevelBadges, não faz nenhum "+1" aqui.
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
function toRoman(n: number): string {
  return ROMAN[n] ?? String(n)
}

function LevelIcon({ level }: { level: number }) {
  const [imgFailed, setImgFailed] = useState(false)
  const isMax = level >= 7
  const asset = isMax ? 'rollercoin/levels/level_legacy.webp' : `rollercoin/levels/level_${level}.webp`

  if (imgFailed) {
    return (
      <span
        className="flex h-4 w-5 items-center justify-center rounded text-[9px] font-bold text-white"
        style={{ backgroundColor: getMergeLevelColor(level) }}
      >
        {isMax ? '★' : toRoman(level)}
      </span>
    )
  }

  return (
    <img
      src={resolveAssetUrl(asset)}
      alt={isMax ? 'legacy' : `nível ${level}`}
      onError={() => setImgFailed(true)}
      className="h-4 w-5 object-contain"
    />
  )
}

function SetIcon() {
  return (
    <img
      src={resolveAssetUrl('rollercoin/levels/level_set.webp')}
      alt="set"
      className="h-4 w-5 object-contain"
    />
  )
}

export default function MinerBadges({
  level,
  isInSet,
  className = 'absolute left-1 top-1',
}: {
  // Nível de raridade do catálogo (0 = base/sem merge, nunca mostra selo
  // de nível -- mesma regra da sala: "isLegacy OU (type==='merge' &&
  // level>0)").
  level: number
  isInSet: boolean
  className?: string
}) {
  const showLevel = level > 0
  if (!showLevel && !isInSet) return null

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {showLevel && <LevelIcon level={level} />}
      {isInSet && <SetIcon />}
    </div>
  )
}
