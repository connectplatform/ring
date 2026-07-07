import type { NewsAiScore } from '@/features/news/types'
import { checkDuplicateNews } from '@/features/news/services/news-duplicate-check'
import { getSiteBaseUrl } from '@/lib/ring-config-core'

// URL for the OpenRouter AI model chat completions endpoint
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// JSON schema describing how the AI must respond with scored values
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

/**
 * Clamp a number between 0 and 1.
 * Used for normalizing AI response values.
 */
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/**
 * Compute suggested price (UAH) for promoting a news item.
 * Pricing is inversely related to the "merit" score.
 * - base: minimum price
 * - scale: how much price can scale up
 * - max: cap the price
 */
function computePriceUah(merit: number): number {
  const base = Number(process.env.NEWS_PROMO_BASE_UAH ?? 50)
  const scale = Number(process.env.NEWS_PROMO_SCALE_UAH ?? 2000)
  const max = Number(process.env.NEWS_PROMO_MAX_UAH ?? 5000)
  return Math.round(Math.min(max, Math.max(base, base + (1 - clamp01(merit)) * scale)))
}

/**
 * Score news for main page promotion using OpenRouter AI.
 * Applies heuristics and external models, blocks content for spam or unethical content, and assigns a suggested promotion price.
 * @param params News metadata and content to score
 */
export async function scoreNewsForMainPage(params: {
  title: string
  excerpt: string
  content: string
  slug: string
  siteWideSlug?: string
  articleId?: string
}): Promise<NewsAiScore> {
  // Check for duplicate content with existing news items (by title and slug)
  const dup = await checkDuplicateNews({
    title: params.title,
    slug: params.slug,
    siteWideSlug: params.siteWideSlug,
    excludeId: params.articleId,
  })

  // Default fallback score values in case AI call fails or is not used
  let ethics = 0.7
  let spamRisk = 0.2
  let merit = 0.5
  let blockReason: string | undefined

  // Choose OpenRouter model (primary, or fallback to default Claude Sonnet)
  const model =
    process.env.OPENROUTER_MODEL_PRIMARY ?? 'anthropic/claude-sonnet-4-5'

  const apiKey = process.env.OPENROUTER_API_KEY
  // If there is an OpenRouter API key, attempt AI scoring
  if (apiKey) {
    try {
      // Construct the AI payload including the schema above for structured scoring responses
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
            // Send title, excerpt, and clamp body for prompt length safety
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
        provider: { zdr: true }, // Custom provider option (domain-specific)
      }

      // Send scoring request to OpenRouter endpoint
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': getSiteBaseUrl(),
          'X-OpenRouter-Title': 'Ring News Promotion',
        },
        body: JSON.stringify(body),
      })

      // If AI responds OK, try to parse out the AI's structured JSON scores
      if (res.ok) {
        const json = await res.json()
        const text = json?.choices?.[0]?.message?.content
        if (text) {
          // TODO: Consider using Zod or a modern schema validator (native structuredClone validation for Next.js 16+) for robust parsing.
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
      // Gracefully handle any fetch/parse errors without blocking normal scoring
      console.error('[news-scoring] OpenRouter failed', e)
    }
  }
  // TODO: If OpenRouter is unavailable, consider batching or using a local ML fallback for scoring, or queuing items for delayed scoring.

  // Heuristic minimums/maximums: pulled from env vars or set to conservative defaults
  const ethicsMin = Number(process.env.NEWS_ETHICS_MIN ?? 0.35)
  const spamMax = Number(process.env.NEWS_SPAM_MAX ?? 0.85)
  const dupMax = Number(process.env.NEWS_DUPLICATE_MAX ?? 0.9)

  // Block content ("hardBlock") if it falls below ethical threshold,
  // is too spammy, or too similar to existing news (duplicate)
  const hardBlock =
    ethics < ethicsMin ||
    spamRisk > spamMax ||
    dup.duplicateRisk > dupMax

  // If item is blocked but AI or heuristics did not set an explicit reason,
  // assign a reasonable default block reason
  if (hardBlock && !blockReason) {
    if (ethics < ethicsMin) blockReason = 'ethics'
    else if (spamRisk > spamMax) blockReason = 'spam'
    else blockReason = 'duplicate'
  }

  // Minimum merit for "soft" rejection (very low = high price for promotion)
  const meritSoft = Number(process.env.NEWS_MERIT_SOFT_REJECT ?? 0.25)
  // Compute suggested promotion price for news item
  const suggestedPriceUah = computePriceUah(merit)

  // TODO: For Next.js 16, use new runtime helpers for time creation (Temporal API) and async functions (if available).

  // Return full AI/heuristic scoring object
  return {
    ethics,
    spamRisk,
    duplicateRisk: dup.duplicateRisk,
    merit,
    // If the merit is too low, force a high minimum price for manual attention
    suggestedPriceUah:
      merit < meritSoft ? Math.max(suggestedPriceUah, 4999) : suggestedPriceUah,
    model: apiKey ? model : 'heuristic', // Indicate which scoring method was used
    scoredAt: new Date().toISOString(), // TODO: Use Temporal.Instant.now().toString() when Node/Next.js supports.
    hardBlock,
    blockReason,
  }
}
