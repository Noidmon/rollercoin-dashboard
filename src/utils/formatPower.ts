export const UNITS = ['Gh/s', 'Th/s', 'Ph/s', 'Eh/s', 'Zh/s', 'Yh/s'] as const

// Determina em qual unidade um valor de poder seria exibido por
// formatPower (mesmo loop de escala, sem truncar) -- extraído pra ser
// reaproveitado por quem precisa saber a unidade ANTES de formatar (ex:
// subtractSmallestDisplayedUnit abaixo).
function scaleToDisplayUnit(value: number): { scaled: number; unitIndex: number } {
  let scaled = value
  let unitIndex = 0
  while (Math.abs(scaled) >= 1000 && unitIndex < UNITS.length - 1) {
    scaled /= 1000
    unitIndex++
  }
  return { scaled, unitIndex }
}

// Subtrai 1 unidade da MENOR casa decimal exibida por formatPower (3 casas,
// truncadas) na escala em que o valor cairia -- ex: 4.000.000.000.000 Gh/s
// (exibido "4.000 Zh/s") vira 3.999.000.000.000 Gh/s ("3.999 Zh/s"), nunca
// o valor redondo exato. Usado pro teto de liga do Auto-Otimizador: o
// mínimo exato da PRÓXIMA liga já pertence a ela no jogo real, então o
// teto de "ficar na liga atual" precisa ser esse mínimo menos 1 passo,
// não o mínimo em si -- confirmado contra a referência real (SmartRoom,
// Prompt 65): próxima liga em 4.000 Zh/s -> teto mostrado "3.999 Zh/s".
export function subtractSmallestDisplayedUnit(value: number): number {
  const { unitIndex } = scaleToDisplayUnit(value)
  const stepInBaseUnit = Math.pow(1000, unitIndex) * 0.001
  return value - stepInBaseUnit
}

export function formatPower(value: number): string {
  const { scaled, unitIndex } = scaleToDisplayUnit(value)

  const sign = scaled < 0 ? '-' : ''
  const absScaled = Math.abs(scaled)

  // Trunca em 3 casas decimais (não arredonda). toFixed(6) só corta ruído de
  // ponto flutuante antes do corte de verdade, feito via string. Sempre
  // mostra as 3 casas (preenche com zero à direita se faltar) -- decisão de
  // produto pra manter a mesma precisão visual em todo lugar que usa poder
  // (ex: "2.610 Zh/s", não "2.61 Zh/s"; "5.000 Th/s", não "5 Th/s").
  const [integerPart, decimalPart = ''] = absScaled.toFixed(6).split('.')
  const truncatedDecimal = decimalPart.slice(0, 3).padEnd(3, '0')

  const formattedInteger = Number(integerPart).toLocaleString('en-US')
  const formatted = `${sign}${formattedInteger}.${truncatedDecimal}`

  return `${formatted} ${UNITS[unitIndex]}`
}
