// Parseia o inventário de mineradores colado pelo jogador (texto puro
// selecionado/copiado da tela "Meus Mineradores" do RollerCoin). Formato
// real, um bloco por cópia possuída de um minerador (o MESMO nome pode
// aparecer várias vezes, um bloco por nível de merge diferente):
//   {Nome}
//   Set
//   Size:
//   {N} Cells
//   Power
//   {valor} {unidade}
//   Bonus
//   {valor} %
//   Quantity:
//   {N}
//   Can't be sold  (ou "Can be sold")
//   Miner details
//   open
// Às vezes tem uma linha solta com só um número entre "open" e o próximo
// bloco (resíduo de algum contador da UI do jogo) -- não é campo de dado.
//
// Contagem fixa de linhas já quebrou 2x nesse projeto (marketplace paste),
// então aqui NÃO se assume offset fixo entre rótulos: ancora em "Set" pra
// achar o início de cada bloco (nome = linha imediatamente antes), depois
// PROCURA À FRENTE por "Size:", "Power", "Bonus", "Quantity:" e a linha de
// sellable, cada um a partir de onde o rótulo anterior foi encontrado --
// funciona não importa quantas linhas estranhas apareçam pelo meio, desde
// que a ORDEM dos rótulos seja respeitada (e é, sempre, no formato real).

import { UNITS } from './formatPower'

export interface MinerInventoryEntry {
  name: string
  cells: number
  powerValue: number // normalizado pra Gh/s
  bonusPercent: number
  quantity: number
  sellable: boolean
}

const SET_LABEL = 'Set'
const SIZE_LABEL = 'Size:'
const POWER_LABEL = 'Power'
const BONUS_LABEL = 'Bonus'
const QUANTITY_LABEL = 'Quantity:'
const SELLABLE_FALSE = "Can't be sold"
const SELLABLE_TRUE = 'Can be sold'

const CELLS_PATTERN = /^(\d+)\s*Cells?$/i
const PERCENT_PATTERN = /^([\d.]+)\s*%$/
const POWER_UNIT_GROUP = UNITS.join('|').replace(/\//g, '\\/')
const POWER_PATTERN = new RegExp(`^([\\d.]+)\\s*(${POWER_UNIT_GROUP})$`, 'i')

export function parsePowerToGhS(text: string): number | null {
  const match = text.match(POWER_PATTERN)
  if (!match) return null
  const value = Number(match[1])
  if (Number.isNaN(value)) return null
  const unitIndex = UNITS.findIndex((u) => u.toLowerCase() === match[2].toLowerCase())
  if (unitIndex === -1) return null
  return value * Math.pow(1000, unitIndex)
}

export function parseMinersInventory(raw: string): MinerInventoryEntry[] {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const entries: MinerInventoryEntry[] = []
  let i = 0

  // Acha a próxima ocorrência de `label` a partir de `from`, sem passar por
  // cima do próximo "Set" (não pode invadir o bloco seguinte).
  function findNext(label: string, from: number): number {
    for (let j = from; j < lines.length; j++) {
      if (lines[j] === label) return j
      if (lines[j] === SET_LABEL) return -1
    }
    return -1
  }

  while (i < lines.length) {
    if (lines[i] !== SET_LABEL) {
      i++
      continue
    }

    const setIndex = i
    const name = lines[setIndex - 1]

    const sizeIdx = findNext(SIZE_LABEL, setIndex + 1)
    if (sizeIdx === -1 || !name) {
      i = setIndex + 1
      continue
    }
    const cellsText = lines[sizeIdx + 1]

    const powerIdx = findNext(POWER_LABEL, sizeIdx + 1)
    if (powerIdx === -1) {
      i = setIndex + 1
      continue
    }
    const powerText = lines[powerIdx + 1]

    const bonusIdx = findNext(BONUS_LABEL, powerIdx + 1)
    if (bonusIdx === -1) {
      i = setIndex + 1
      continue
    }
    const bonusText = lines[bonusIdx + 1]

    const quantityIdx = findNext(QUANTITY_LABEL, bonusIdx + 1)
    if (quantityIdx === -1) {
      i = setIndex + 1
      continue
    }
    const quantityText = lines[quantityIdx + 1]

    let sellable: boolean | null = null
    let sellableIdx = -1
    for (let j = quantityIdx + 1; j < lines.length; j++) {
      if (lines[j] === SET_LABEL) break
      if (lines[j] === SELLABLE_FALSE) {
        sellable = false
        sellableIdx = j
        break
      }
      if (lines[j] === SELLABLE_TRUE) {
        sellable = true
        sellableIdx = j
        break
      }
    }
    if (sellable === null) {
      i = setIndex + 1
      continue
    }

    const cellsMatch = cellsText?.match(CELLS_PATTERN)
    const bonusMatch = bonusText?.match(PERCENT_PATTERN)
    const powerValue = powerText ? parsePowerToGhS(powerText) : null
    const quantity = quantityText ? Number(quantityText) : NaN

    if (!cellsMatch || !bonusMatch || powerValue === null || Number.isNaN(quantity)) {
      i = setIndex + 1
      continue
    }

    entries.push({
      name,
      cells: Number(cellsMatch[1]),
      powerValue,
      bonusPercent: Number(bonusMatch[1]),
      quantity,
      sellable,
    })

    i = sellableIdx + 1
  }

  return entries
}
