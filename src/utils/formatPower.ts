export const UNITS = ['Gh/s', 'Th/s', 'Ph/s', 'Eh/s', 'Zh/s', 'Yh/s'] as const

export function formatPower(value: number): string {
  let scaled = value
  let unitIndex = 0

  while (Math.abs(scaled) >= 1000 && unitIndex < UNITS.length - 1) {
    scaled /= 1000
    unitIndex++
  }

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
