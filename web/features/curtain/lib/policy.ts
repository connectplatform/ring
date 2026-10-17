import { CURTAIN_MAX_IMPRESSIONS_PER_DAY } from '@/features/curtain/constants'
import type { CurtainPolicy, CurtainProductSource } from '@/features/curtain/types'

const SOURCES: CurtainProductSource[] = ['page_then_pool', 'page_only', 'pool_only']

export function parseCurtainPolicy(raw: unknown): CurtainPolicy {
  const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const source = rec.productSource
  const productSource = SOURCES.includes(source as CurtainProductSource)
    ? (source as CurtainProductSource)
    : 'page_then_pool'
  const max = Number(rec.maxImpressionsPerDay)
  const hours = Number(rec.notTodayHours)
  return {
    enabled: rec.enabled !== false,
    productSource,
    maxImpressionsPerDay:
      Number.isFinite(max) && max >= 1 && max <= 50 ? Math.round(max) : CURTAIN_MAX_IMPRESSIONS_PER_DAY,
    notTodayHours: Number.isFinite(hours) && hours >= 1 && hours <= 168 ? Math.round(hours) : 24,
  }
}
