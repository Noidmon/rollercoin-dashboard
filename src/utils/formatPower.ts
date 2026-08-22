const UNITS = ['Gh/s', 'Th/s', 'Ph/s', 'Eh/s', 'Zh/s', 'Yh/s'] as const

export function formatPower(value: number): string {
  let scaled = value
  let unitIndex = 0

  while (Math.abs(scaled) >= 1000 && unitIndex < UNITS.length - 1) {
    scaled /= 1000
    unitIndex++
  }

  const formatted = scaled.toLocaleString('en-US', {
    maximumFractionDigits: 3,
  })

  return `${formatted} ${UNITS[unitIndex]}`
}
