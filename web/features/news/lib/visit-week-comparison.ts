/**
 * Build weekday visit series: this week vs the same weekday four weeks ago.
 * Expects activity rows with ISO date (YYYY-MM-DD) and views count.
 */

export type VisitActivityDay = {
  date: string
  views: number
}

export type VisitWeekComparisonPoint = {
  weekday: string
  thisWeek: number
  fourWeeksAgo: number
  dateThisWeek: string
  dateFourWeeksAgo: string
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function toUtcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addUtcDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

/** Fill missing calendar days with 0 views for the last `dayCount` UTC days (inclusive of today). */
export function densifyVisitActivity(
  activity: VisitActivityDay[],
  dayCount = 35,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of activity) {
    map.set(row.date, (map.get(row.date) ?? 0) + (row.views || 0))
  }

  const today = new Date()
  const densified = new Map<string, number>()
  for (let i = dayCount - 1; i >= 0; i -= 1) {
    const key = toUtcDateKey(addUtcDays(today, -i))
    densified.set(key, map.get(key) ?? 0)
  }
  return densified
}

/**
 * Last 7 UTC days vs the same weekday 28 days earlier.
 * Chart-ready for rewards-style dual LineChart / BarChart.
 */
export function buildVisitWeekComparison(
  activity: VisitActivityDay[],
): VisitWeekComparisonPoint[] {
  const densified = densifyVisitActivity(activity, 35)
  const today = new Date()
  const points: VisitWeekComparisonPoint[] = []

  for (let i = 6; i >= 0; i -= 1) {
    const thisDay = addUtcDays(today, -i)
    const priorDay = addUtcDays(thisDay, -28)
    const thisKey = toUtcDateKey(thisDay)
    const priorKey = toUtcDateKey(priorDay)
    points.push({
      weekday: WEEKDAY_SHORT[thisDay.getUTCDay()],
      thisWeek: densified.get(thisKey) ?? 0,
      fourWeeksAgo: densified.get(priorKey) ?? 0,
      dateThisWeek: thisKey,
      dateFourWeeksAgo: priorKey,
    })
  }

  return points
}

/** Rolling 4 weekly totals (ending today), for bar comparison. */
export function buildWeeklyVisitTotals(
  activity: VisitActivityDay[],
): Array<{ weekLabel: string; views: number; weekStart: string }> {
  const densified = densifyVisitActivity(activity, 28)
  const today = new Date()
  const weeks: Array<{ weekLabel: string; views: number; weekStart: string }> = []

  for (let w = 3; w >= 0; w -= 1) {
    let total = 0
    const weekEnd = addUtcDays(today, -(w * 7))
    const weekStart = addUtcDays(weekEnd, -6)
    for (let d = 0; d < 7; d += 1) {
      const key = toUtcDateKey(addUtcDays(weekStart, d))
      total += densified.get(key) ?? 0
    }
    weeks.push({
      weekLabel: w === 0 ? 'This week' : w === 1 ? '1w ago' : `${w}w ago`,
      views: total,
      weekStart: toUtcDateKey(weekStart),
    })
  }

  return weeks
}
