import { SUPPORTED_LOCALES } from '@/lib/locale-config'

const RESERVED = new Set(['checkout', 'cart', 'orders', 'vendors', 'settings'])

export function extractCurtainProductIds(content: string, max = 12): string[] {
  if (!content?.trim()) return []
  const locales = SUPPORTED_LOCALES.join('|')
  const re = new RegExp(
    `(?:https?:\\/\\/[^\\s"'<>]+)?\\/(?:(?:${locales})\\/)?store\\/([A-Za-z0-9_-]{1,80})(?=[\\s"'?#<>)\\]]|$)`,
    'gi',
  )
  const ids: string[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) && ids.length < max) {
    const id = match[1]
    if (!id || RESERVED.has(id) || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

export function topicOverlap(pageTopics: string[], productTopics: string[]): number {
  const page = new Set(pageTopics.map((topic) => topic.trim().toLowerCase()).filter(Boolean))
  if (page.size === 0) return 0
  let hits = 0
  for (const topic of productTopics) {
    const key = topic.trim().toLowerCase()
    if (key && page.has(key)) hits += 1
  }
  return hits
}

/** Higher sorts first: linked SKUs, then topic overlap, then fewer impressions. */
export function curtainOfferScore(input: {
  fromPage: boolean
  overlap: number
  impressions: number
}): number {
  return (input.fromPage ? 10_000 : 0) + input.overlap * 100 - input.impressions
}
