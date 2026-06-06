import type { NewsAiScore } from '@/features/news/types'
import { checkDuplicateNews } from '@/features/news/services/news-duplicate-check'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    ethics: { type: 'number', description: '0-1 higher is more ethical/acceptable' },
    spamRisk: { type: 'number', description: '0-1 higher is more spam-like' },
    merit: { type: 'number', description: '0-1 public interest / quality' },
    blockReason: { type: 'string' },
  },
  required: ['ethics', 'spamRisk', 'merit'],
  additionalProperties: false,
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function computePriceUah(merit: number): number {
  const base = Number(process.env.NEWS_PROMO_BASE_UAH ?? 50)
  const scale = Number(process.env.NEWS_PROMO_SCALE_UAH ?? 2000)
  const max = Number(process.env.NEWS_PROMO_MAX_UAH ?? 5000)
  return Math.round(Math.min(max, Math.max(base, base + (1 - clamp01(merit)) * scale)))
}

export async function scoreNewsForMainPage(params: {
  title: string
  excerpt: string
  content: string
  slug: string
  siteWideSlug?: string
  articleId?: string
}): Promise<NewsAiScore> {
  const dup = await checkDuplicateNews({
    title: params.title,
    slug: params.slug,
    siteWideSlug: params.siteWideSlug,
    excludeId: params.articleId,
  })

  let ethics = 0.7
  let spamRisk = 0.2
  let merit = 0.5
  let blockReason: string | undefined
  const model =
    process.env.OPENROUTER_MODEL_PRIMARY ?? 'anthropic/claude-sonnet-4-5'

  const apiKey = process.env.OPENROUTER_API_KEY
  if (apiKey) {
    try {
      const body = {
        model,
        models: [
          model,
          process.env.OPENROUTER_MODEL_FALLBACK ?? 'openai/gpt-4o-mini',
        ],
        messages: [
          {
            role: 'system',
            content:
              'Score user-submitted news for main-page promotion. ethics 0-1 (higher=ok), spamRisk 0-1 (higher=spam), merit 0-1 (public value). Reject scams, hate, impersonation, pure ads.',
          },
          {
            role: 'user',
            content: `Title: ${params.title}\nExcerpt: ${params.excerpt}\nBody: ${params.content.slice(0, 8000)}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'news_score',
            strict: true,
            schema: SCORE_SCHEMA,
          },
        },
        provider: { zdr: true },
      }

      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ringplatform.org',
          'X-OpenRouter-Title': 'Ring News Promotion',
        },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const json = await res.json()
        const text = json?.choices?.[0]?.message?.content
        if (text) {
          const parsed = JSON.parse(text) as {
            ethics: number
            spamRisk: number
            merit: number
            blockReason?: string
          }
          ethics = clamp01(Number(parsed.ethics))
          spamRisk = clamp01(Number(parsed.spamRisk))
          merit = clamp01(Number(parsed.merit))
          blockReason = parsed.blockReason
        }
      }
    } catch (e) {
      console.error('[news-scoring] OpenRouter failed', e)
    }
  }

  const ethicsMin = Number(process.env.NEWS_ETHICS_MIN ?? 0.35)
  const spamMax = Number(process.env.NEWS_SPAM_MAX ?? 0.85)
  const dupMax = Number(process.env.NEWS_DUPLICATE_MAX ?? 0.9)

  const hardBlock =
    ethics < ethicsMin ||
    spamRisk > spamMax ||
    dup.duplicateRisk > dupMax

  if (hardBlock && !blockReason) {
    if (ethics < ethicsMin) blockReason = 'ethics'
    else if (spamRisk > spamMax) blockReason = 'spam'
    else blockReason = 'duplicate'
  }

  const meritSoft = Number(process.env.NEWS_MERIT_SOFT_REJECT ?? 0.25)
  const suggestedPriceUah = computePriceUah(merit)

  return {
    ethics,
    spamRisk,
    duplicateRisk: dup.duplicateRisk,
    merit,
    suggestedPriceUah:
      merit < meritSoft ? Math.max(suggestedPriceUah, 4999) : suggestedPriceUah,
    model: apiKey ? model : 'heuristic',
    scoredAt: new Date().toISOString(),
    hardBlock,
    blockReason,
  }
}
