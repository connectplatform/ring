import { getPublicPoolConfig } from '@/lib/ring-config-core'

export function goalHoursFromImplementationCost(implementationCost: number): number {
  const { minGoalHours } = getPublicPoolConfig()
  const hours = Number.isFinite(implementationCost)
    ? Math.max(Math.floor(implementationCost), minGoalHours)
    : minGoalHours
  return hours
}

/** goal_native_token = goal_hours × ringPerMachineHour (decimal string). */
export function goalRingFromHours(goalHours: number): string {
  const { ringPerMachineHour } = getPublicPoolConfig()
  const ring = goalHours * ringPerMachineHour
  return String(ring)
}

export function parseRingDecimal(value: string): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

export function addRingDecimals(a: string, b: string): string {
  const sum = parseRingDecimal(a) + parseRingDecimal(b)
  return sum.toFixed(8).replace(/\.?0+$/, '') || '0'
}

export function fundingProgressPct(pledgedRing: string, goalRing: string): number {
  const goal = parseRingDecimal(goalRing)
  if (goal <= 0) return 0
  return Math.min(100, Math.round((parseRingDecimal(pledgedRing) / goal) * 100))
}
