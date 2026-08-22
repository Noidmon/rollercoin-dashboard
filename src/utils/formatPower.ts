const UNITS = ['Gh/s', 'Th/s', 'Ph/s', 'Eh/s', 'Zh/s', 'Yh/s'] as const

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
  // ponto flutuante antes do corte de verdade, feito via string.
  const [integerPart, decimalPart = ''] = absScaled.toFixed(6).split('.')
  const truncatedDecimal = decimalPart.slice(0, 3).replace(/0+$/, '')

  const formattedInteger = Number(integerPart).toLocaleString('en-US')
  const formatted = truncatedDecimal
    ? `${sign}${formattedInteger}.${truncatedDecimal}`
    : `${sign}${formattedInteger}`

  return `${formatted} ${UNITS[unitIndex]}`
}
