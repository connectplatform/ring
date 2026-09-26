/**
 * URL / body parser for opportunity browse + search.
 * No server-only imports — safe for OpportunityList and API routes.
 */

export type OpportunityDeadlineWindow = 'today' | 'week' | 'month' | 'any' | 'all' | 'no-deadline'

export interface OpportunityListQuery {
  query?: string
  types?: string[]
  categories?: string[]
  location?: string
  budgetMin?: number
  budgetMax?: number
  currency?: string
  priority?: 'urgent' | 'normal' | 'low' | 'all' | 'any'
  deadline?: OpportunityDeadlineWindow
  hasDeadline?: boolean
  limit?: number
  startAfter?: string
  sortBy?: 'relevance' | 'dateCreated' | 'dateUpdated' | 'budget' | 'deadline' | 'location'
  sortOrder?: 'asc' | 'desc'
}

type ParamSource = URLSearchParams | Record<string, unknown>

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0].trim()
  }
  return undefined
}

function readRaw(source: ParamSource, key: string): unknown {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined
  return source[key]
}

function csvOrArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item || '').trim()).filter(Boolean)
    return items.length > 0 ? items : undefined
  }
  const raw = firstString(value)
  if (!raw) return undefined
  const items = raw.split(',').map((item) => item.trim()).filter(Boolean)
  return items.length > 0 ? items : undefined
}

function parseNumber(value: unknown): number | undefined {
  const raw = firstString(value)
  if (!raw) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

function parseBool(value: unknown): boolean | undefined {
  const raw = firstString(value)
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (typeof value === 'boolean') return value
  return undefined
}

const DEADLINES = new Set(['today', 'week', 'month', 'any', 'all', 'no-deadline'])
const PRIORITIES = new Set(['urgent', 'normal', 'low', 'all', 'any'])
const SORTS = new Set(['relevance', 'dateCreated', 'dateUpdated', 'budget', 'deadline', 'location'])

export function parseOpportunityListQuery(source: ParamSource): OpportunityListQuery {
  const query = firstString(readRaw(source, 'q')) || firstString(readRaw(source, 'query'))
  const types = csvOrArray(readRaw(source, 'types'))
  const categories = csvOrArray(readRaw(source, 'categories'))
  const location = firstString(readRaw(source, 'location'))
  const budgetMin = parseNumber(readRaw(source, 'budgetMin'))
  const budgetMax = parseNumber(readRaw(source, 'budgetMax'))
  const currency = firstString(readRaw(source, 'currency'))
  const priorityRaw = firstString(readRaw(source, 'priority'))
  const deadlineRaw = firstString(readRaw(source, 'deadline'))
  const hasDeadline = parseBool(readRaw(source, 'hasDeadline'))
  const limit = parseNumber(readRaw(source, 'limit'))
  const startAfter =
    firstString(readRaw(source, 'startAfter')) || firstString(readRaw(source, 'afterId'))
  const sortByRaw = firstString(readRaw(source, 'sortBy'))
  const sortOrderRaw = firstString(readRaw(source, 'sortOrder'))

  const parsed: OpportunityListQuery = {}
  if (query) parsed.query = query
  if (types) parsed.types = types
  if (categories) parsed.categories = categories
  if (location) parsed.location = location
  if (budgetMin !== undefined) parsed.budgetMin = budgetMin
  if (budgetMax !== undefined) parsed.budgetMax = budgetMax
  if (currency) parsed.currency = currency
  if (priorityRaw && PRIORITIES.has(priorityRaw)) {
    parsed.priority = priorityRaw as OpportunityListQuery['priority']
  }
  if (deadlineRaw && DEADLINES.has(deadlineRaw)) {
    parsed.deadline = deadlineRaw as OpportunityDeadlineWindow
  }
  if (hasDeadline !== undefined) parsed.hasDeadline = hasDeadline
  if (limit !== undefined) parsed.limit = Math.min(Math.max(Math.trunc(limit), 1), 100)
  if (startAfter) parsed.startAfter = startAfter
  if (sortByRaw && SORTS.has(sortByRaw)) {
    parsed.sortBy = sortByRaw as OpportunityListQuery['sortBy']
  }
  if (sortOrderRaw === 'asc' || sortOrderRaw === 'desc') parsed.sortOrder = sortOrderRaw
  // entityVerified is a ghost field — ignored on purpose.
  return parsed
}
