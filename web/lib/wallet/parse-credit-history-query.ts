import 'server-only'

import type { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  CreditHistoryRequestSchema,
  CreditBalanceTransactionType,
  type CreditHistoryRequest,
} from '@/lib/zod/credit-schemas'
import { queryInt, queryString } from '@/lib/server/request'
import { logger } from '@/lib/logger'

/** Wallet activity tab values — not valid CreditBalanceTransactionType; ignore instead of 400. */
const WALLET_ACTIVITY_FILTER_VALUES = new Set(['all', 'credit', 'chain'])

function parseLimit(request: NextRequest): number {
  const raw = queryInt(request, 'limit')
  if (raw == null || raw < 1 || raw > 100) return 50
  return raw
}

function parseTransactionTypeFilter(
  request: NextRequest,
): CreditHistoryRequest['type'] | undefined {
  const rawType = queryString(request, 'type')
  if (!rawType) return undefined

  const parsed = CreditBalanceTransactionType.safeParse(rawType)
  if (parsed.success) return parsed.data

  if (WALLET_ACTIVITY_FILTER_VALUES.has(rawType)) {
    logger.debug('Ignoring wallet activity filter sent as credit history type', {
      rawType,
    })
    return undefined
  }

  logger.warn('Ignoring unknown credit history type filter', { rawType })
  return undefined
}

export type ParseCreditHistoryQueryResult =
  | { success: true; data: CreditHistoryRequest }
  | {
      success: false
      queryParams: Record<string, unknown>
      issues: z.ZodIssue[]
    }

/**
 * Parse GET /api/wallet/credit/history query params.
 * Coerces limit, drops invalid/activity-tab type values (never 400 for type=credit|chain|all).
 */
export function parseCreditHistoryQuery(
  request: NextRequest,
): ParseCreditHistoryQueryResult {
  const queryParams = {
    limit: parseLimit(request),
    after_id: queryString(request, 'after_id'),
    type: parseTransactionTypeFilter(request),
    start_date: queryInt(request, 'start_date'),
    end_date: queryInt(request, 'end_date'),
  }

  const parsed = CreditHistoryRequestSchema.safeParse(queryParams)
  if (!parsed.success) {
    return {
      success: false,
      queryParams,
      issues: parsed.error.issues,
    }
  }

  return { success: true, data: parsed.data }
}
