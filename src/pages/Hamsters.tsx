import { Fragment, useState } from 'react'
import { HAMSTERS, type Hamster } from '../data/hamsters'
import { EXPEDITIONS } from '../data/expeditions'
import {
  calculateHamsterTotalStats,
  calculateSurvivalChance,
} from '../utils/calculateHamsterSurvival'
import Card from '../components/Card'

type SortDirection = 'asc' | 'desc'

const GENERATION_LABELS: Record<1 | 2 | 3, string> = {
  1: '1ª Geração',
  2: '2ª Geração',
  3: '3ª Geração',
}

function survivalColorClass(percent: number): string {
  if (percent > 70) return 'text-emerald-400'
  if (percent >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

function HamsterImage({ hamster, level }: { hamster: Hamster; level: number }) {
  const [failed, setFailed] = useState(false)
  const src = hamster.imageUrl(level)

  if (!src || failed) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-800 text-lg text-slate-600">
        ?
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={hamster.name}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-12 w-12 shrink-0 rounded-full bg-slate-800 object-contain"
    />
  )
}

export default function Hamsters() {
  const [levels, setLevels] = useState<Record<string, number>>({})
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  function levelFor(slug: string): number {
    return levels[slug] ?? 1
  }

  function setLevel(slug: string, level: number) {
    setLevels((prev) => ({ ...prev, [slug]: level }))
  }

  function handleSort(expeditionSlug: string) {
    if (sortColumn === expeditionSlug) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortColumn(expeditionSlug)
      setSortDirection('desc')
    }
  }

  function survivalFor(hamster: Hamster, expeditionSlug: string): number {
    const expedition = EXPEDITIONS.find((e) => e.slug === expeditionSlug)!
    const totalStats = calculateHamsterTotalStats(hamster, levelFor(hamster.slug))
    return calculateSurvivalChance(
      totalStats,
      expedition.difficulty,
      hamster.survivalAbilityBonus,
    )
  }

  const sortedHamsters = sortColumn
    ? [...HAMSTERS].sort((a, b) => {
        const av = survivalFor(a, sortColumn)
        const bv = survivalFor(b, sortColumn)
        return sortDirection === 'desc' ? bv - av : av - bv
      })
    : null

  function renderRow(hamster: Hamster) {
    const level = levelFor(hamster.slug)
    const totalStats = calculateHamsterTotalStats(hamster, level)
    const infoText = [...hamster.abilitiesText, hamster.ultimateText]
      .filter((text): text is string => Boolean(text))
      .join(' • ')

    return (
      <tr key={hamster.slug} className="border-b border-slate-800/60">
        <td className="py-2 pr-3">
          <div className="flex items-center gap-3">
            <HamsterImage hamster={hamster} level={level} />
            <div>
              <p className="text-sm font-medium text-slate-200">{hamster.name}</p>
              {infoText && (
                <p className="max-w-xs text-xs text-slate-500" title={infoText}>
                  {infoText}
                </p>
              )}
            </div>
          </div>
        </td>
        <td className="py-2 pr-3">
          <select
            value={level}
            onChange={(e) => setLevel(hamster.slug, Number(e.target.value))}
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {Array.from({ length: 50 }, (_, i) => i + 1).map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
        </td>
        <td className="py-2 pr-3 text-slate-300">{totalStats}</td>
        {EXPEDITIONS.map((expedition) => {
          const chance = survivalFor(hamster, expedition.slug)
          return (
            <td
              key={expedition.slug}
              className={`py-2 pr-3 font-medium ${survivalColorClass(chance)}`}
            >
              {chance.toFixed(1)}%
            </td>
          )
        })}
      </tr>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Hamsters</h1>

      <div className="mt-4">
        <Card title="Sobrevivência em Expedições">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase text-slate-400">
                  <th className="py-2 pr-3 font-medium">Hamster</th>
                  <th className="py-2 pr-3 font-medium">Nível</th>
                  <th className="py-2 pr-3 font-medium">Stats Totais</th>
                  {EXPEDITIONS.map((expedition) => (
                    <th
                      key={expedition.slug}
                      className="cursor-pointer select-none py-2 pr-3 font-medium"
                      onClick={() => handleSort(expedition.slug)}
                    >
                      {expedition.name}{' '}
                      {sortColumn === expedition.slug &&
                        (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedHamsters
                  ? sortedHamsters.map((hamster) => renderRow(hamster))
                  : ([1, 2, 3] as const).map((gen) => {
                      const hamstersInGen = HAMSTERS.filter((h) => h.generation === gen)
                      if (!hamstersInGen.length) return null
                      return (
                        <Fragment key={gen}>
                          <tr className="bg-slate-800/50">
                            <td
                              colSpan={3 + EXPEDITIONS.length}
                              className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"
                            >
                              {GENERATION_LABELS[gen]}
                            </td>
                          </tr>
                          {hamstersInGen.map((hamster) => renderRow(hamster))}
                        </Fragment>
                      )
                    })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
