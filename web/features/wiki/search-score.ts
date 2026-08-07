import type { WikiPage, WikiSearchMatch, VaultKey } from '@/features/wiki/types'

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9@:_-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
}

/** Lexical scorer mirroring legiox-knowledge weights (in-vault corpus). */
export function scoreWikiPages(
  pages: WikiPage[],
  query: string,
  context?: string,
): WikiSearchMatch[] {
  const terms = [...new Set([...tokenize(query), ...tokenize(context || '')])]
  if (terms.length === 0) return []

  const floor = terms.length <= 2 ? 12 : 18
  const matches: WikiSearchMatch[] = []

  for (const page of pages) {
    const title = page.title.toLowerCase()
    const slug = page.slug.toLowerCase()
    const path = page.path.toLowerCase()
    const body = page.bodyMarkdown.toLowerCase()
    const tags = (page.frontmatter.tags || []).map((t) => t.toLowerCase())
    const aliases = (page.frontmatter.aliases || []).map((t) => t.toLowerCase())
    const blob = `${title} ${slug} ${path} ${body} ${tags.join(' ')} ${aliases.join(' ')}`

    let score = 0
    const matched: string[] = []
    for (const term of terms) {
      let hit = false
      if (title === term || slug === term) {
        score += 12
        hit = true
      } else if (title.includes(term) || aliases.some((a) => a.includes(term))) {
        score += 8
        hit = true
      } else if (path.includes(term) || slug.includes(term)) {
        score += 6
        hit = true
      } else if (tags.some((t) => t.includes(term))) {
        score += 6
        hit = true
      } else if (body.includes(term)) {
        score += 4
        hit = true
      } else if (blob.includes(term)) {
        score += 4
        hit = true
      }
      if (hit) matched.push(term)
    }

    if (score < floor || matched.length === 0) continue

    const snippet = buildSnippet(page.bodyMarkdown || page.title, matched[0])
    matches.push({
      concept: page.title,
      path: `${page.vaultKey}/${page.path ? page.path + '/' : ''}${page.slug}`,
      confidence: Math.min(0.98, score / (floor * 2)),
      score,
      matched_terms: matched,
      snippet,
      quick_answers: [page.title, snippet].filter(Boolean),
      related_concepts: page.frontmatter.tags || [],
      pageId: page.id,
      vaultKey: page.vaultKey as VaultKey,
      slug: page.slug,
    })
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 10)
}

function buildSnippet(body: string, term: string): string {
  const lower = body.toLowerCase()
  const idx = lower.indexOf(term.toLowerCase())
  if (idx < 0) return body.slice(0, 160).replace(/\s+/g, ' ').trim()
  const start = Math.max(0, idx - 40)
  const end = Math.min(body.length, idx + term.length + 80)
  return body.slice(start, end).replace(/\s+/g, ' ').trim()
}
