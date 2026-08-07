import type { ChangelogEntry } from '@/lib/changelog/types'

export type FutureMilestoneStatus = 'in_progress' | 'planned'

export type FutureMilestone = {
  id: string
  period: string
  title: string
  summary: string
  status: FutureMilestoneStatus
}

export type JourneyReleaseNode = {
  kind: 'release'
  id: string
  version: string
  date: string
  mods: string[]
  /** Compact bullets for the scrubber card (no full GFM mount). */
  preview: { heading?: string; bullets: string[] }
}

export type JourneyNowNode = {
  kind: 'now'
  id: 'now'
  version: string
  date?: string
  label: string
  /** Latest changelog preview — NOW is the current production release. */
  preview: { heading?: string; bullets: string[] }
}

export type JourneyFutureNode = {
  kind: 'future'
  id: string
  period: string
  title: string
  summary: string
  status: FutureMilestoneStatus
}

export type JourneyNode = JourneyReleaseNode | JourneyNowNode | JourneyFutureNode

/** Strip GFM markers for scrubber preview lines. */
export function stripInlineMd(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
}

/** Build a short preview from changelog mod markdown blocks. */
export function summarizeMods(mods: string[]): { heading?: string; bullets: string[] } {
  const bullets: string[] = []

  for (const mod of mods) {
    for (const line of mod.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      // Ignore keep-a-changelog / section headings ("Added", "Docs", …) — tiles use vX.Y.Z.
      if (/^#{1,6}\s+/.test(trimmed)) continue
      const bullet = trimmed.match(/^[-*+]\s+(.+)$/)
      if (bullet?.[1] && bullets.length < 8) {
        bullets.push(stripInlineMd(bullet[1]))
      }
    }
  }

  return { bullets }
}

export type BuildJourneyInput = {
  changelog: ChangelogEntry[]
  futureMilestones: FutureMilestone[]
  nowLabel: string
  /** Prefer newest changelog version; fallback string if empty. */
  currentVersionFallback?: string
}

/**
 * Scrubber order bottom→top (progress 0→1):
 * oldest release … previous release → NOW (= newest changelog as current production)
 * → in_progress futures → planned futures.
 *
 * Changelog JSON is newest-first; we reverse for chronological ascent.
 * Newest entry is NOT duplicated as both a release and NOW.
 */
export function buildJourney(input: BuildJourneyInput): JourneyNode[] {
  const { changelog, futureMilestones, nowLabel, currentVersionFallback = '1.97' } = input

  const chronological = [...changelog].reverse()
  const newest = chronological[chronological.length - 1]
  const prior = chronological.slice(0, -1)

  const releases: JourneyReleaseNode[] = prior.map((entry) => ({
    kind: 'release',
    id: `release-${entry.version}-${entry.date}`,
    version: entry.version,
    date: entry.date,
    mods: entry.mods,
    preview: summarizeMods(entry.mods),
  }))

  const nowVersion = newest?.version ?? currentVersionFallback

  const inProgress = futureMilestones
    .filter((m) => m.status === 'in_progress')
    .map(
      (m): JourneyFutureNode => ({
        kind: 'future',
        id: m.id,
        period: m.period,
        title: m.title,
        summary: m.summary,
        status: m.status,
      }),
    )

  const planned = futureMilestones
    .filter((m) => m.status === 'planned')
    .map(
      (m): JourneyFutureNode => ({
        kind: 'future',
        id: m.id,
        period: m.period,
        title: m.title,
        summary: m.summary,
        status: m.status,
      }),
    )

  const now: JourneyNowNode = {
    kind: 'now',
    id: 'now',
    version: nowVersion,
    date: newest?.date,
    label: nowLabel,
    preview: newest ? summarizeMods(newest.mods) : { bullets: [] },
  }

  return [...releases, now, ...inProgress, ...planned]
}

/** Map Motion progress 0..1 to nearest node index. */
export function progressToIndex(progress: number, length: number): number {
  if (length <= 1) return 0
  const clamped = Math.min(1, Math.max(0, progress))
  return Math.round(clamped * (length - 1))
}

export function indexToProgress(index: number, length: number): number {
  if (length <= 1) return 0
  return index / (length - 1)
}
