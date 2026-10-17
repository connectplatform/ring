/**
 * Cross-Ecosystem Need Matcher Service
 *
 * Matches a resident's or user's stated need across active public:
 * - Opportunities (`opportunities`)
 * - Civic & business entities (`entities`)
 * - Local marketplace products & services (`store_products`)
 *
 * Combines bilingual/multilingual (UA / EN / RU) semantic concept groups,
 * morphological stem matching, district affinity, and optional bounded LLM
 * refinement (with strict 4-second timeout) to produce actionable matches
 * that can immediately open a 1-on-1 direct or context conversation.
 */

import { getDatabaseService, initializeDatabase, unwrapDbQueryRow } from '@/lib/database'
import { createLLMClientAsync, isLLMAvailable } from '@/lib/ai/llm-client'
import { withLocale } from '@/constants/routes'
import { defaultLocale, type Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { logger } from '@/lib/logger'
import {
  getBaselineNeedMatches,
  getCityDistrictAliases,
} from '@/features/map/lib/baseline-city-pois'

export interface EcosystemMatch {
  id: string
  kind: 'opportunity' | 'entity' | 'product' | 'user'
  title: string
  subtitle: string
  category?: string
  district?: string
  price?: string
  currency?: string
  matchScore: number // 0..100
  matchReason: string
  targetUserId?: string
  entityId?: string
  href: string
}

export interface MatchNeedParams {
  needText: string
  locale?: string
  limit?: number
  viewerUserId?: string
}

export interface MatchNeedResult {
  matches: EcosystemMatch[]
  usedLlm: boolean
}

interface SemanticConceptGroup {
  id: string
  terms: string[]
  reasonUk: string
  reasonEn: string
}

const CONCEPT_GROUPS: SemanticConceptGroup[] = [
  {
    id: 'sewing_textile',
    terms: [
      'sewing',
      'tailor',
      'seamstress',
      'machine',
      'garment',
      'clothes',
      'clothing',
      'fabric',
      'textile',
      'overlock',
      'embroidery',
      'швейн',
      'машинк',
      'шитт',
      'пошив',
      'кравец',
      'кравчин',
      'швачк',
      'ательє',
      'ателье',
      'одяг',
      'одежд',
      'тканин',
      'оверлок',
      'вишивк',
      'ремонт одягу',
    ],
    reasonUk: 'Пропонує швейне обладнання, пошив або ремонт одягу у вашій громаді',
    reasonEn: 'Offers sewing equipment, tailoring, or garment repair in your community',
  },
  {
    id: 'auto_mobility',
    terms: [
      'car',
      'auto',
      'automotive',
      'repair',
      'mechanic',
      'tire',
      'tyre',
      'parts',
      'diagnostics',
      'garage',
      'tow',
      'transport',
      'delivery',
      'авто',
      'автомобіл',
      'ремонт авто',
      'сто',
      'шиномонтаж',
      'запчастин',
      'механік',
      'автосервіс',
      'ходова',
      'двигун',
      'мастил',
      'евакуатор',
      'транспорт',
      'перевезенн',
    ],
    reasonUk: 'Відповідає запиту з автосервісу, ремонту транспорту або логістики',
    reasonEn: 'Matches your automotive repair, maintenance, or local transport need',
  },
  {
    id: 'jobs_career',
    terms: [
      'job',
      'work',
      'vacancy',
      'career',
      'internship',
      'hiring',
      'employment',
      'freelance',
      'recruiting',
      'робот',
      'вакансі',
      'ваканси',
      'працевлаштуванн',
      'стажуванн',
      'підробіток',
      'фріланс',
      'спеціаліст',
      'майстер',
      'найм',
      'кадрам',
      'работа',
    ],
    reasonUk: 'Актуальна місцева вакансія або пропозиція професійного залучення',
    reasonEn: 'Active local vacancy or professional work opportunity matching your skills',
  },
  {
    id: 'utilities_311',
    terms: [
      'water',
      'heat',
      'heating',
      'light',
      'electricity',
      'utility',
      'utilities',
      'outage',
      'leak',
      'pipe',
      'plumber',
      'road',
      'pothole',
      'street',
      'lighting',
      'garbage',
      'waste',
      '311',
      'вода',
      'водопостачанн',
      'світл',
      'тепл',
      'опаленн',
      'водоканал',
      'теплокомуненерго',
      'аварі',
      'прорив',
      'труб',
      'сантехнік',
      'ліхтар',
      'освітленн',
      'благоустрі',
      'дорог',
      'ям',
      'смітт',
      'комунальн',
      'жкг',
    ],
    reasonUk: 'Профільна комунальна служба або міська ініціатива з благоустрою та ЖКГ',
    reasonEn: 'Dedicated municipal utility service or urban infrastructure initiative',
  },
  {
    id: 'shelter_resilience',
    terms: [
      'shelter',
      'invincibility',
      'resilience',
      'power',
      'generator',
      'charging',
      'charge',
      'starlink',
      'internet',
      'wifi',
      'emergency',
      'safety',
      'heating point',
      'powerbank',
      'укритт',
      'сховищ',
      'незламност',
      'пункт незламності',
      'генератор',
      'зарядк',
      'зарядит',
      'павербанк',
      'старлінк',
      'інтернет',
      'обігрів',
      'безпек',
      'тривог',
      'дснс',
      'екстрен',
      'убежищ',
    ],
    reasonUk: 'Пункт незламності, резервне живлення або служба безпеки поруч із вами',
    reasonEn: 'Invincibility Point, backup power hub, or safety service in your area',
  },
  {
    id: 'food_local_farm',
    terms: [
      'food',
      'bread',
      'honey',
      'farm',
      'farmer',
      'organic',
      'dairy',
      'milk',
      'cheese',
      'vegetables',
      'fruit',
      'berries',
      'bakery',
      'coffee',
      'craft',
      'produce',
      'їж',
      'продукт',
      'фермер',
      'мед',
      'пасік',
      'хліб',
      'пекарн',
      'випічк',
      'молок',
      'сир',
      'молочн',
      'овоч',
      'фрукт',
      'ягод',
      'кав',
      'крафтов',
      'виробник',
      'еда',
    ],
    reasonUk: 'Локальний виробник або фермерська продукція з доставкою по місту',
    reasonEn: 'Verified local producer or farm product with city-wide availability',
  },
  {
    id: 'healthcare_medical',
    terms: [
      'doctor',
      'clinic',
      'hospital',
      'pharmacy',
      'medicine',
      'medical',
      'health',
      'dentist',
      'rehabilitation',
      'psychologist',
      'veteran',
      'лікар',
      'клінік',
      'поліклінік',
      'лікарн',
      'амбулаторі',
      'аптек',
      'лік',
      'медицин',
      'здоров',
      'стоматолог',
      'реабілітаці',
      'психолог',
      'ветеран',
      'медичн',
      'врач',
    ],
    reasonUk: 'Медичний заклад, реабілітаційний центр або служба підтримки здоров’я',
    reasonEn: 'Healthcare facility, rehabilitation hub, or medical support provider',
  },
  {
    id: 'education_children',
    terms: [
      'school',
      'kindergarten',
      'course',
      'tutor',
      'university',
      'library',
      'training',
      'workshop',
      'kids',
      'children',
      'sport',
      'youth',
      'школ',
      'ліце',
      'гімназі',
      'садочок',
      'дитсадок',
      'курс',
      'навчанн',
      'репетитор',
      'університет',
      'бібліотек',
      'гурток',
      'тренуванн',
      'спорт',
      'діт',
      'дитяч',
      'молод',
      'освіт',
    ],
    reasonUk: 'Освітній простір, навчальна програма або спортивна секція громади',
    reasonEn: 'Educational space, training initiative, or community youth program',
  },
  {
    id: 'equipment_tools_sharing',
    terms: [
      'tool',
      'tools',
      'equipment',
      'rent',
      'rental',
      'borrow',
      'share',
      'sharing',
      'drill',
      'ladder',
      'chainsaw',
      'printer',
      'laptop',
      'інструмент',
      'обладнанн',
      'оренд',
      'прокат',
      'позичит',
      'спільне користування',
      'дриль',
      'перфоратор',
      'драбин',
      'бензопил',
      'будівельн',
      'принтер',
      'ноутбук',
      'технік',
      'шеринг',
    ],
    reasonUk: 'Пропонує спільне користування або оренду обладнання у вашому районі',
    reasonEn: 'Provides equipment sharing, tool rental, or mutual resource access nearby',
  },
  {
    id: 'volunteering_aid',
    terms: [
      'volunteer',
      'volunteering',
      'mutual aid',
      'charity',
      'donation',
      'help',
      'support',
      'ngo',
      'community',
      'toloka',
      'humanitarian',
      'волонтер',
      'взаємодопомог',
      'толок',
      'благодійн',
      'збір',
      'допомог',
      'підтримк',
      'громад',
      'переселенц',
      'впо',
      'гуманітарн',
    ],
    reasonUk: 'Ініціатива взаємодопомоги, волонтерський штаб або громадська організація',
    reasonEn: 'Community mutual-aid initiative, volunteer hub, or civic NGO',
  },
]

interface RawCandidate {
  id: string
  kind: 'opportunity' | 'entity' | 'product' | 'user'
  title: string
  subtitle: string
  searchableText: string
  category?: string
  district?: string
  price?: string
  currency?: string
  targetUserId?: string
  entityId?: string
  href: string
}

function normalizeLocale(locale?: string): Locale {
  if (locale && routing.locales.includes(locale as Locale)) {
    return locale as Locale
  }
  return defaultLocale
}

function tokenizeAndStem(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)

  const stopWords = new Set([
    'для',
    'або',
    'про',
    'при',
    'від',
    'над',
    'під',
    'між',
    'але',
    'щоб',
    'мені',
    'нам',
    'вам',
    'його',
    'неї',
    'них',
    'який',
    'яка',
    'яке',
    'які',
    'потрібно',
    'потрібна',
    'потрібен',
    'потрібні',
    'шукаю',
    'шукаємо',
    'хочу',
    'можна',
    'будь',
    'ласка',
    'днів',
    'дні',
    'день',
    'the',
    'and',
    'for',
    'with',
    'need',
    'looking',
    'where',
    'can',
    'find',
    'from',
    'that',
    'this',
    'have',
    'has',
  ])

  const filtered = cleaned.filter((token) => !stopWords.has(token))
  const stems = new Set<string>()
  for (const token of filtered) {
    stems.add(token)
    if (token.length >= 6) {
      stems.add(token.slice(0, token.length - 2))
    } else if (token.length >= 5) {
      stems.add(token.slice(0, token.length - 1))
    }
  }
  return Array.from(stems)
}

function detectDistrict(text: string): string | undefined {
  const lower = text.toLowerCase()
  for (const entry of getCityDistrictAliases()) {
    if (entry.aliases.some((alias) => lower.includes(alias))) {
      return entry.canonical
    }
  }
  return undefined
}

function detectConceptGroups(text: string): SemanticConceptGroup[] {
  const lower = text.toLowerCase()
  return CONCEPT_GROUPS.filter((group) =>
    group.terms.some((term) => lower.includes(term.toLowerCase())),
  )
}

function extractUserId(row: Record<string, unknown>): string | undefined {
  const candidates = [
    row.createdBy,
    row.userId,
    row.ownerId,
    row.addedBy,
    row.vendorId,
    row.vendor_id,
    row.productOwner,
    (row.creator as { id?: unknown } | undefined)?.id,
    (row.contactInfo as { contactAccount?: unknown } | undefined)?.contactAccount,
    Array.isArray(row.members) ? row.members[0] : undefined,
  ]
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim()
    }
  }
  return undefined
}

function extractEntityId(row: Record<string, unknown>, kind: RawCandidate['kind']): string | undefined {
  if (kind === 'entity' && typeof row.id === 'string') {
    return row.id
  }
  const candidates = [
    row.organizationId,
    row.ownerEntityId,
    row.entity_id,
    (row.contactInfo as { linkedEntity?: unknown } | undefined)?.linkedEntity,
    (row.metadata as { assignedEntityId?: unknown } | undefined)?.assignedEntityId,
  ]
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim()
    }
  }
  return undefined
}

function extractDistrictFromRow(row: Record<string, unknown>): string | undefined {
  const metadata = row.metadata as Record<string, unknown> | undefined
  const nicheData = row.nicheData as { city?: { district?: string } } | undefined
  const cityMeta = row.cityMetadata as { district?: string } | undefined

  const direct =
    (typeof metadata?.district === 'string' && metadata.district.trim()) ||
    (typeof nicheData?.city?.district === 'string' && nicheData.city.district.trim()) ||
    (typeof cityMeta?.district === 'string' && cityMeta.district.trim()) ||
    (typeof row.district === 'string' && row.district.trim()) ||
    undefined

  if (direct) return direct

  const locationStr = typeof row.location === 'string' ? row.location : ''
  return detectDistrict(locationStr)
}

function scoreCandidate(
  needText: string,
  needStems: string[],
  needGroups: SemanticConceptGroup[],
  needDistrict: string | undefined,
  candidate: RawCandidate,
  locale: Locale,
): { score: number; reason: string } {
  const candidateLower = candidate.searchableText.toLowerCase()
  const titleLower = candidate.title.toLowerCase()
  let score = 0

  // 1. Concept group alignment (up to 55 pts)
  let matchedGroup: SemanticConceptGroup | undefined
  let matchedGroupCount = 0
  for (const group of needGroups) {
    const groupHit = group.terms.some((term) => candidateLower.includes(term.toLowerCase()))
    if (groupHit) {
      matchedGroupCount += 1
      if (!matchedGroup) matchedGroup = group
    }
  }
  if (matchedGroupCount > 0) {
    score += Math.min(45 + (matchedGroupCount - 1) * 10, 55)
  }

  // 2. Direct stem / keyword overlap (up to 35 pts)
  let stemHits = 0
  let titleHits = 0
  for (const stem of needStems) {
    if (stem.length < 3) continue
    if (candidateLower.includes(stem)) {
      stemHits += 1
      if (titleLower.includes(stem)) {
        titleHits += 1
      }
    }
  }
  if (needStems.length > 0 && stemHits > 0) {
    const ratio = Math.min(stemHits / Math.max(Math.min(needStems.length, 4), 1), 1)
    score += Math.round(ratio * 25) + Math.min(titleHits * 5, 10)
  }

  // 3. District proximity bonus (up to 12 pts)
  const districtMatched =
    needDistrict &&
    candidate.district &&
    candidate.district.toLowerCase().includes(needDistrict.toLowerCase())
  if (districtMatched) {
    score += 12
  } else if (needDistrict && candidateLower.includes(needDistrict.toLowerCase())) {
    score += 8
  }

  // 4. Direct target user availability bonus (up to 5 pts)
  if (candidate.targetUserId) {
    score += 5
  }

  const clampedScore = Math.min(Math.max(Math.round(score), 0), 99)

  // Generate localized human-readable matchReason
  const isEn = locale === 'en'
  let reason: string
  if (matchedGroup) {
    reason = isEn ? matchedGroup.reasonEn : matchedGroup.reasonUk
    if (districtMatched && candidate.district) {
      reason += isEn ? ` (${candidate.district})` : ` (${candidate.district})`
    }
  } else if (stemHits > 0) {
    if (candidate.kind === 'opportunity') {
      reason = isEn
        ? 'Matches your stated need by community opportunity keywords and local availability'
        : 'Збігається за ключовими словами вашої потреби серед активних пропозицій громади'
    } else if (candidate.kind === 'entity') {
      reason = isEn
        ? 'Verified local organization or service provider matching your request'
        : 'Профільна організація або установа громади, що надає відповідні послуги'
    } else {
      reason = isEn
        ? 'Available local product or service in the city marketplace matching your need'
        : 'Доступний товар або послуга місцевого надавача у міському маркетплейсі'
    }
  } else {
    reason = isEn
      ? 'Matches your need by service category and local availability'
      : 'Пропонує спільне користування або релевантні послуги у вашому районі'
  }

  return { score: clampedScore, reason }
}

async function safeQueryCollection(
  collection: string,
  limit: number,
): Promise<Array<Record<string, unknown> & { id: string }>> {
  try {
    const db = getDatabaseService()
    const res = await db.query({
      collection,
      filters: [],
      pagination: { limit },
    })
    if (!res.success || !Array.isArray(res.data)) {
      return []
    }
    return res.data.map((doc) => unwrapDbQueryRow<Record<string, unknown>>(doc))
  } catch (error) {
    logger.warn(`need-matcher: safeQueryCollection failed for ${collection}`, {
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

async function refineMatchesWithBoundedLlm(
  needText: string,
  candidates: EcosystemMatch[],
  locale: Locale,
): Promise<{ refined: EcosystemMatch[]; usedLlm: boolean }> {
  const hasProviderKey = Boolean(
    process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || isLLMAvailable(),
  )
  if (!hasProviderKey || candidates.length === 0) {
    return { refined: candidates, usedLlm: false }
  }

  const timeoutMs = 4000
  try {
    const llmPromise = (async () => {
      const client = await createLLMClientAsync(true)
      const langLabel = locale === 'en' ? 'English' : 'Ukrainian'
      const candidateLines = candidates
        .map(
          (c, idx) =>
            `${idx + 1}. id="${c.id}" kind="${c.kind}" title="${c.title}" subtitle="${c.subtitle}" category="${c.category || ''}" district="${c.district || ''}" heuristicScore=${c.matchScore}`,
        )
        .join('\n')

      const prompt = `You are a civic & community AI matcher for a regional digital city platform.
Resident stated need: "${needText}"

Evaluate these top candidate matches and return a JSON array of objects:
[{"id": "...", "matchScore": 0-100, "matchReason": "Concise 1-sentence reason in ${langLabel} (max 140 chars) explaining why this helps the resident"}]

Candidates:
${candidateLines}

Return ONLY valid JSON array.`

      const response = await client.complete(prompt, {
        temperature: 0.2,
        maxTokens: 600,
      })

      const jsonMatch = response.content.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return null
      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        id?: string
        matchScore?: number
        matchReason?: string
      }>
      if (!Array.isArray(parsed)) return null
      return parsed
    })()

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs)
    })

    const llmOut = await Promise.race([llmPromise, timeoutPromise])
    if (!llmOut || llmOut.length === 0) {
      return { refined: candidates, usedLlm: false }
    }

    const byId = new Map(llmOut.map((item) => [item.id, item]))
    const updated = candidates
      .map((c) => {
        const override = byId.get(c.id)
        if (!override) return c
        const nextScore =
          typeof override.matchScore === 'number' && !Number.isNaN(override.matchScore)
            ? Math.min(Math.max(Math.round(override.matchScore), 1), 100)
            : c.matchScore
        const nextReason =
          typeof override.matchReason === 'string' && override.matchReason.trim().length > 5
            ? override.matchReason.trim().slice(0, 180)
            : c.matchReason
        return {
          ...c,
          matchScore: nextScore,
          matchReason: nextReason,
        }
      })
      .sort((a, b) => b.matchScore - a.matchScore)

    return { refined: updated, usedLlm: true }
  } catch (error) {
    logger.warn('need-matcher: LLM refinement skipped due to error or timeout', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { refined: candidates, usedLlm: false }
  }
}

/**
 * Matches a free-text resident/community need across public opportunities,
 * civic/commercial entities, and store products.
 */
export async function matchNeedAcrossEcosystem(
  params: MatchNeedParams,
): Promise<MatchNeedResult> {
  const needText = (params.needText || '').trim()
  const locale = normalizeLocale(params.locale)
  const limit = Math.min(Math.max(params.limit ?? 6, 1), 20)

  if (needText.length < 2) {
    return { matches: [], usedLlm: false }
  }

  await initializeDatabase()

  const [oppRows, entityRows, productRows] = await Promise.all([
    safeQueryCollection('opportunities', 80),
    safeQueryCollection('entities', 80),
    safeQueryCollection('store_products', 80),
  ])

  const candidates: RawCandidate[] = []

  // 1. Map active public opportunities
  for (const row of oppRows) {
    if (!row.id) continue
    const isConfidential = row.isConfidential === true || row.visibility === 'confidential'
    if (isConfidential) continue
    const visibility = typeof row.visibility === 'string' ? row.visibility : 'public'
    if (visibility !== 'public' && visibility !== 'subscriber') continue
    const status = typeof row.status === 'string' ? row.status : 'active'
    if (status === 'archived' || status === 'closed' || status === 'expired') continue

    const targetUserId = extractUserId(row)
    if (params.viewerUserId && targetUserId === params.viewerUserId && row.title === needText.slice(0, 100)) {
      continue
    }

    const title = typeof row.title === 'string' ? row.title.trim() : ''
    if (!title) continue
    const brief = typeof row.briefDescription === 'string' ? row.briefDescription.trim() : ''
    const full = typeof row.fullDescription === 'string' ? row.fullDescription.trim() : ''
    const category = typeof row.category === 'string' ? row.category : typeof row.type === 'string' ? row.type : undefined
    const tags = Array.isArray(row.tags) ? row.tags.join(' ') : ''
    const skills = Array.isArray(row.requiredSkills) ? row.requiredSkills.join(' ') : ''
    const location = typeof row.location === 'string' ? row.location : ''
    const district = extractDistrictFromRow(row)
    const budget = row.budget as { min?: number; max?: number; currency?: string } | undefined
    const price =
      budget && typeof budget.max === 'number' && budget.max > 0
        ? String(budget.max)
        : budget && typeof budget.min === 'number' && budget.min > 0
          ? String(budget.min)
          : undefined
    const currency = budget?.currency

    candidates.push({
      id: row.id,
      kind: 'opportunity',
      title,
      subtitle: brief.slice(0, 140) || location || (locale === 'en' ? 'Community opportunity' : 'Можливість громади'),
      searchableText: `${title} ${brief} ${full} ${category || ''} ${tags} ${skills} ${location} ${district || ''}`,
      category,
      district,
      price,
      currency,
      targetUserId,
      entityId: extractEntityId(row, 'opportunity'),
      href: withLocale(locale, `/opportunities/${row.id}`),
    })
  }

  // 2. Map active public entities
  for (const row of entityRows) {
    if (!row.id) continue
    const isConfidential = row.isConfidential === true || row.visibility === 'confidential'
    if (isConfidential) continue
    if (row.moderationStatus === 'blocked') continue
    const visibility = typeof row.visibility === 'string' ? row.visibility : 'public'
    if (visibility !== 'public' && visibility !== 'subscriber') continue

    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!name) continue
    const shortDesc = typeof row.shortDescription === 'string' ? row.shortDescription.trim() : ''
    const fullDesc = typeof row.fullDescription === 'string' ? row.fullDescription.trim() : ''
    const type = typeof row.type === 'string' ? row.type : undefined
    const services = Array.isArray(row.services) ? row.services.join(' ') : ''
    const tags = Array.isArray(row.tags) ? row.tags.join(' ') : ''
    const industries = Array.isArray(row.industries) ? row.industries.join(' ') : ''
    const location = typeof row.location === 'string' ? row.location : ''
    const district = extractDistrictFromRow(row)

    candidates.push({
      id: row.id,
      kind: 'entity',
      title: name,
      subtitle: shortDesc.slice(0, 140) || location || (locale === 'en' ? 'Civic & community entity' : 'Організація громади'),
      searchableText: `${name} ${shortDesc} ${fullDesc} ${type || ''} ${services} ${tags} ${industries} ${location} ${district || ''}`,
      category: type,
      district,
      targetUserId: extractUserId(row),
      entityId: row.id,
      href: withLocale(locale, `/entities/${row.id}`),
    })
  }

  // 3. Map active store products
  for (const row of productRows) {
    if (!row.id) continue
    const status = typeof row.status === 'string' ? row.status : 'active'
    if (status !== 'active') continue

    const name =
      (typeof row.name === 'string' && row.name.trim()) ||
      (typeof row.title === 'string' && row.title.trim()) ||
      ''
    if (!name) continue
    const desc = typeof row.description === 'string' ? row.description.trim() : ''
    const longDesc = typeof row.longDescription === 'string' ? row.longDescription.trim() : ''
    const category = typeof row.category === 'string' ? row.category : undefined
    const vendorName =
      (typeof row.vendorName === 'string' && row.vendorName) ||
      (typeof row.vendor_name === 'string' && row.vendor_name) ||
      ''
    const tags = Array.isArray(row.tags) ? row.tags.join(' ') : ''
    const district = extractDistrictFromRow(row)
    const rawPrice = row.price !== undefined && row.price !== null ? String(row.price) : undefined
    const currency = typeof row.currency === 'string' ? row.currency : 'UAH'

    candidates.push({
      id: row.id,
      kind: 'product',
      title: name,
      subtitle:
        desc.slice(0, 140) ||
        vendorName ||
        (locale === 'en' ? 'Local marketplace item' : 'Пропозиція міського маркетплейсу'),
      searchableText: `${name} ${desc} ${longDesc} ${category || ''} ${vendorName} ${tags} ${district || ''}`,
      category,
      district,
      price: rawPrice,
      currency,
      targetUserId: extractUserId(row),
      entityId: extractEntityId(row, 'product'),
      href: withLocale(locale, `/store/${row.id}`),
    })
  }

  const baselineCandidates = getBaselineNeedMatches(locale)
  for (const base of baselineCandidates) {
    if (!candidates.some((c) => c.id === base.id || c.title === base.title)) {
      candidates.push(base)
    }
  }

  const needStems = tokenizeAndStem(needText)
  const needGroups = detectConceptGroups(needText)
  const needDistrict = detectDistrict(needText)

  const scored: EcosystemMatch[] = []
  for (const candidate of candidates) {
    const { score, reason } = scoreCandidate(
      needText,
      needStems,
      needGroups,
      needDistrict,
      candidate,
      locale,
    )
    if (score > 0) {
      scored.push({
        id: candidate.id,
        kind: candidate.kind,
        title: candidate.title,
        subtitle: candidate.subtitle,
        category: candidate.category,
        district: candidate.district,
        price: candidate.price,
        currency: candidate.currency,
        matchScore: Math.max(score, 35),
        matchReason: reason,
        targetUserId: candidate.targetUserId,
        entityId: candidate.entityId,
        href: candidate.href,
      })
    }
  }

  // If no lexical/concept hit occurred, provide top general community fallback items with modest scores
  if (scored.length === 0) {
    for (const fallback of candidates.slice(0, limit)) {
      scored.push({
        id: fallback.id,
        kind: fallback.kind,
        title: fallback.title,
        subtitle: fallback.subtitle,
        category: fallback.category,
        district: fallback.district,
        price: fallback.price,
        currency: fallback.currency,
        matchScore: 42,
        matchReason:
          locale === 'en'
            ? 'Matches your need by service category and local availability'
            : 'Пропонує спільне користування або актуальні послуги у вашій громаді',
        targetUserId: fallback.targetUserId,
        entityId: fallback.entityId,
        href: fallback.href,
      })
    }
  }

  scored.sort((a, b) => b.matchScore - a.matchScore)
  const topCandidates = scored.slice(0, limit)

  const { refined, usedLlm } = await refineMatchesWithBoundedLlm(needText, topCandidates, locale)

  return {
    matches: refined.slice(0, limit),
    usedLlm,
  }
}
