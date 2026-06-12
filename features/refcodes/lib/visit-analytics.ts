/** Visit window stats derived from refcode `visitDaily` buckets (YYYY-MM-DD → count). */

export type VisitWindowStats = {
  total: number
  today: number
  last7d: number
  last28d: number
}

export const VISIT_DAILY_RETENTION_DAYS = 28

export function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

function windowStartKeys(now = new Date()) {
  const todayKey = utcDateKey(now)
  const d7 = new Date(now)
  d7.setUTCDate(d7.getUTCDate() - 6)
  const d28 = new Date(now)
  d28.setUTCDate(d28.getUTCDate() - (VISIT_DAILY_RETENTION_DAYS - 1))
  return { todayKey, key7: utcDateKey(d7), key28: utcDateKey(d28) }
}

export function pruneVisitDaily(daily: Record<string, number> | undefined): Record<string, number> {
  if (!daily) return {}
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - VISIT_DAILY_RETENTION_DAYS)
  const cutoffKey = utcDateKey(cutoff)
  const pruned: Record<string, number> = {}
  for (const [day, count] of Object.entries(daily)) {
    if (day >= cutoffKey && count > 0) pruned[day] = count
  }
  return pruned
}

export function bumpVisitDaily(
  daily: Record<string, number> | undefined,
  totalVisits: number,
): { visits: number; visitDaily: Record<string, number> } {
  const today = utcDateKey()
  const base = pruneVisitDaily(daily ?? {})
  base[today] = (base[today] ?? 0) + 1
  return { visits: totalVisits + 1, visitDaily: base }
}

export function visitStatsFromDaily(
  visits: number,
  daily: Record<string, number> | undefined,
  now = new Date(),
): VisitWindowStats {
  const { todayKey, key7, key28 } = windowStartKeys(now)
  let today = 0
  let last7d = 0
  let last28d = 0

  for (const [day, count] of Object.entries(daily ?? {})) {
    if (day === todayKey) today += count
    if (day >= key7) last7d += count
    if (day >= key28) last28d += count
  }

  return { total: visits, today, last7d, last28d }
}

export function visitStatsFromDoc(
  doc: Record<string, unknown>,
  now = new Date(),
): VisitWindowStats {
  const visits = typeof doc.visits === 'number' ? doc.visits : 0
  const daily = doc.visitDaily as Record<string, number> | undefined
  return visitStatsFromDaily(visits, daily, now)
}

export function aggregateVisitStats(
  rows: Array<Record<string, unknown>>,
  now = new Date(),
): VisitWindowStats {
  const acc: VisitWindowStats = { total: 0, today: 0, last7d: 0, last28d: 0 }
  for (const row of rows) {
    const doc = (row.data ?? row) as Record<string, unknown>
    const stats = visitStatsFromDoc(doc, now)
    acc.total += stats.total
    acc.today += stats.today
    acc.last7d += stats.last7d
    acc.last28d += stats.last28d
  }
  return acc
}
