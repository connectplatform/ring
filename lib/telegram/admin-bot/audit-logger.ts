/**
 * ADMIN TELEGRAM BOT - Audit Logger
 * Logs all admin bot interactions to telegram_admin_audit table
 * 
 * Truth Lens:
 * - @legiox/postgres-db-specialist.json
 * - @legiox/ring-backend-administrator.json
 * 
 * Security:
 * - Full audit trail for compliance
 * - PALADIN Layer 5: Post-deployment governance
 * - Stores raw messages, parsed intents, actions, results, and errors
 */

import { getDatabaseService, initializeDatabase } from '@/lib/database/DatabaseService'
import { ParsedCommand } from './anthropic-router'
import { ExecutionResult } from './ring-api-executor'
import { v4 as uuidv4 } from 'uuid'

export interface AuditLogEntry {
  id: string
  telegram_id: string
  user_id: string | null
  raw_message: string
  parsed_intent: any
  action_taken: any
  result: any
  error: string | null
  created_at: Date
}

/**
 * Log admin bot interaction to audit table
 * 
 * @param telegramId - Telegram Chat ID of sender
 * @param userId - Ring Platform user ID (ADMIN/SUPERADMIN)
 * @param rawMessage - Original message text from Telegram
 * @param parsedCommand - Parsed command from Anthropic
 * @param executionResult - Result from ring-api-executor
 */
export async function logInteraction(
  telegramId: string,
  userId: string | null,
  rawMessage: string,
  parsedCommand: ParsedCommand | null,
  executionResult: ExecutionResult | null
): Promise<void> {
  try {
    await initializeDatabase()
    const db = getDatabaseService()

    const auditEntry: AuditLogEntry = {
      id: uuidv4(),
      telegram_id: telegramId,
      user_id: userId,
      raw_message: rawMessage,
      parsed_intent: parsedCommand
        ? {
            tool_name: parsedCommand.toolName,
            tool_input: parsedCommand.toolInput,
            raw_response: parsedCommand.rawResponse,
          }
        : null,
      action_taken: executionResult?.metadata || null,
      result: executionResult?.success
        ? executionResult.data
        : null,
      error: executionResult?.success === false ? executionResult.error || 'Unknown error' : null,
      created_at: new Date(),
    }

    // Insert into telegram_admin_audit table
    const result = await db.create('telegram_admin_audit', auditEntry)

    if (!result.success) {
      console.error('[AUDIT LOGGER] Failed to log interaction:', result.error)
    }
  } catch (error) {
    console.error('[AUDIT LOGGER] Error logging interaction:', error)
    // Don't throw - audit logging failure should not block bot operation
  }
}

/**
 * Log failed webhook request (invalid secret, unauthorized sender, etc.)
 * 
 * @param telegramId - Telegram Chat ID (if available)
 * @param rawMessage - Original message text
 * @param errorReason - Reason for failure
 */
export async function logFailedRequest(
  telegramId: string | null,
  rawMessage: string | null,
  errorReason: string
): Promise<void> {
  try {
    await initializeDatabase()
    const db = getDatabaseService()

    const auditEntry: AuditLogEntry = {
      id: uuidv4(),
      telegram_id: telegramId || 'unknown',
      user_id: null,
      raw_message: rawMessage || '[no message]',
      parsed_intent: null,
      action_taken: null,
      result: null,
      error: errorReason,
      created_at: new Date(),
    }

    const result = await db.create('telegram_admin_audit', auditEntry)

    if (!result.success) {
      console.error('[AUDIT LOGGER] Failed to log failed request:', result.error)
    }
  } catch (error) {
    console.error('[AUDIT LOGGER] Error logging failed request:', error)
  }
}

/**
 * Get recent audit logs for a user
 * 
 * @param userId - Ring Platform user ID
 * @param limit - Maximum number of logs to return (default: 10)
 * @returns Array of audit log entries
 */
export async function getAuditLogs(userId: string, limit: number = 10): Promise<AuditLogEntry[]> {
  try {
    await initializeDatabase()
    const db = getDatabaseService()

    // db.query() expects a DatabaseQuery object (see IDatabaseService.ts)
    // Pagination settings must be passed via the 'pagination' property per interface
    const result = await db.query({
      collection: 'telegram_admin_audit',
      filters: [{ field: 'user_id', operator: '==', value: userId }],
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: Math.min(limit || 10, 100) }, // Max 100 records
    })

    if (!result.success) {
      console.error('[AUDIT LOGGER] Failed to fetch audit logs:', result.error)
      return []
    }

    return result.data.map((log: any) => log as AuditLogEntry) || []
  } catch (error) {
    console.error('[AUDIT LOGGER] Error fetching audit logs:', error)
    return []
  }
}

/**
 * Get audit statistics for monitoring
 * 
 * @returns Summary statistics for audit logs
 */
export async function getAuditStats(): Promise<{
  total: number
  errors: number
  successful: number
  by_user: Record<string, number>
}> {
  try {
    await initializeDatabase()
    const db = getDatabaseService()

    const result = await db.query({
      collection: 'telegram_admin_audit',
      filters: [] as any,
    })

    if (!result.success) {
      console.error('[AUDIT LOGGER] Failed to fetch audit stats:', result.error)
      return { total: 0, errors: 0, successful: 0, by_user: {} }
    }

    const logs = result.data.map((log: any) => log as AuditLogEntry) || []

    const stats = {
      total: logs.length,
      errors: logs.filter((log: any) => log.error).length,
      successful: logs.filter((log: any) => !log.error).length,
      by_user: logs.reduce((acc: Record<string, number>, log: any) => {
        const userId = log.user_id || 'unknown'
        acc[userId] = (acc[userId] || 0) + 1
        return acc
      }, {}),
    }

    return stats
  } catch (error) {
    console.error('[AUDIT LOGGER] Error fetching audit stats:', error)
    return { total: 0, errors: 0, successful: 0, by_user: {} }
  }
}
