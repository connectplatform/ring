import 'server-only'

import type { UsageRecord } from '@/services/email/ai/cost-tracker'
import { upsertDoc, queryDocs } from '@/features/email-crm/lib/jsonb-collection'

const COLLECTION = 'email_api_usage'

export const EmailApiUsageService = {
  async save(record: UsageRecord): Promise<void> {
    await upsertDoc(
      COLLECTION,
      record.requestId,
      {
        emailId: record.emailId,
        model: record.model,
        operation: record.operation,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        cacheReadTokens: record.cacheReadTokens,
        cacheWriteTokens: record.cacheWriteTokens,
        costUsd: record.costUsd,
        latencyMs: record.latencyMs,
        success: record.success,
        errorMessage: record.errorMessage,
        timestamp: record.timestamp.toISOString(),
      }
    )
  },

  async listSince(since: Date, limit = 5000): Promise<Array<Record<string, unknown> & { id: string }>> {
    const rows = await queryDocs<Record<string, unknown>>({
      collection: COLLECTION,
      orderBy: [{ field: 'timestamp', direction: 'desc' }],
      limit,
    })
    return rows.filter((row) => {
      const ts = row.timestamp as string | undefined
      return ts && new Date(ts) >= since
    })
  },
}
