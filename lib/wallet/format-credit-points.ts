/** Whole credit points — minimum unit is 1 point (no fractional points). */
export function formatCreditPoints(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (!Number.isFinite(n) || n <= 0) return '0'
  return String(Math.floor(n))
}

export function parseCreditPoints(value: string): number {
  const n = parseFloat(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n)
}
