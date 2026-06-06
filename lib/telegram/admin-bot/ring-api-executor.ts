/**
 * ADMIN TELEGRAM BOT - Ring API Executor
 * Executes Ring API operations from parsed Anthropic tool calls
 * 
 * Truth Lens:
 * - @legiox/ring-backend-administrator.json
 * - @legiox/postgres-db-specialist.json
 * 
 * Security:
 * - ADMIN can CRUD on most entities, restricted from users delete and settings write
 * - SUPERADMIN has full access
 * - All operations logged to audit table
 */

import { getDatabaseService, initializeDatabase } from '@/lib/database/DatabaseService'
import { UserRole } from '@/features/auth/types'
import { ParsedCommand } from './anthropic-router'

export interface ExecutionResult {
  success: boolean
  data?: any
  error?: string
  metadata?: {
    operation: string
    entity: string
    recordsAffected?: number
  }
}

/**
 * Execute a ring_crud operation
 * Maps Anthropic tool calls to DatabaseService API
 * 
 * @param toolInput - Parsed tool input from Anthropic
 * @param userRole - User role (ADMIN or SUPERADMIN)
 * @returns Execution result with data or error
 */
async function executeRingCrud(
  toolInput: any,
  userRole: UserRole
): Promise<ExecutionResult> {
  const { operation, entity, id, data, filters, limit } = toolInput

  // Permission checks
  if (operation === 'delete' && entity === 'users' && userRole !== UserRole.SUPERADMIN) {
    return {
      success: false,
      error: 'ADMIN role cannot delete users. SUPERADMIN required.',
    }
  }

  if (
    (operation === 'create' || operation === 'update') &&
    entity === 'settings' &&
    userRole !== UserRole.SUPERADMIN
  ) {
    return {
      success: false,
      error: 'ADMIN role cannot modify settings. SUPERADMIN required.',
    }
  }

  try {
    await initializeDatabase()
    const db = getDatabaseService()

    // Execute operation
    switch (operation) {
      case 'create': {
        if (!data) {
          return {
            success: false,
            error: 'Data required for create operation',
          }
        }

        const result = await db.create(entity, data)

        if (!result.success) {
          return {
            success: false,
            error: result.error?.message || 'Create operation failed',
          } as ExecutionResult
        }

        return {
          success: true,
          data: result.data,
          metadata: {
            operation: 'create',
            entity,
            recordsAffected: 1,
          },
        }
      }

      case 'read': {
        if (!id) {
          return {
            success: false,
            error: 'ID required for read operation',
          }
        }

        const result = await db.findById(entity, id)

        if (!result.success) {
          return {
            success: false,
            error: result.error?.message || 'Record not found',
          }
        }

        return {
          success: true,
          data: result.data,
          metadata: {
            operation: 'read',
            entity,
          },
        }
      }

      case 'update': {
        if (!id || !data) {
          return {
            success: false,
            error: 'ID and data required for update operation',
          }
        }

        const result = await db.update(entity, id, data)

        if (!result.success) {
          return {
            success: false,
            error: result.error || 'Update operation failed',
          } as ExecutionResult
        }

        return {
          success: true,
          data: result.data,
          metadata: {
            operation: 'update',
            entity,
            recordsAffected: 1,
          },
        }
      }

      case 'delete': {
        if (!id) {
          return {
            success: false,
            error: 'ID required for delete operation',
          }
        }

        const result = await db.delete(entity, id)

        if (!result.success) {
          return {
            success: false,
            error: result.error || 'Delete operation failed',
          } as ExecutionResult
        }

        return {
          success: true,
          data: { deleted: true, id },
          metadata: {
            operation: 'delete',
            entity,
            recordsAffected: 1,
          },
        }
      }

      case 'list': {
        const queryFilters = filters
          ? Object.entries(filters).map(([field, value]) => ({
              field,
              operator: '==' as const,
              value,
            }))
          : []

        const result = await db.query({
          collection: entity,
          filters: queryFilters,
          orderBy: [{ field: 'created_at', direction: 'desc' }],
          pagination: { limit: Math.min(limit || 10, 100) }, // Max 100 records
        })

        if (!result.success) {
          return {
            success: false,
            error: result.error || 'List operation failed',
          } as ExecutionResult
        }

        const records = result.data || []

        return {
          success: true,
          data: records,
          metadata: {
            operation: 'list',
            entity,
            recordsAffected: records.length,
          },
        }
      }

      default:
        return {
          success: false,
          error: `Unknown operation: ${operation}`,
        }
    }
  } catch (error: any) {
    console.error('[RING API EXECUTOR] Error executing CRUD:', error)
    return {
      success: false,
      error: error.message || 'Internal error during operation',
    }
  }
}

/**
 * Execute a ring_report operation
 * Generates summary reports via DatabaseService queries
 * 
 * @param toolInput - Parsed tool input from Anthropic
 * @returns Execution result with report data
 */
async function executeRingReport(toolInput: any): Promise<ExecutionResult> {
  const { report_type, date_range } = toolInput

  try {
    await initializeDatabase()
    const db = getDatabaseService()

    switch (report_type) {
      case 'users_summary': {
        const result = await db.query({
          collection: 'users',
          filters: [],
        })

        if (!result.success) {
          return { success: false, error: 'Failed to fetch users' }
        }

        const users = result.data || []
        const summary = {
          total: users.length,
          by_role: users.reduce((acc: any, user: any) => {
            const role = user.data?.role || 'visitor'
            acc[role] = (acc[role] || 0) + 1
            return acc
          }, {}),
          active: users.filter((u: any) => u.data?.accountStatus === 'ACTIVE').length,
        }

        return {
          success: true,
          data: summary,
          metadata: { operation: 'report', entity: 'users_summary' },
        }
      }

      case 'orders_today': {
        const today = new Date().toISOString().split('T')[0]
        const result = await db.query({
          collection: 'orders',
          filters: [],
        })

        if (!result.success) {
          return { success: false, error: 'Failed to fetch orders' }
        }

        const orders = result.data || []
        const todayOrders = orders.filter((order: any) => {
          const createdDate = new Date(order.created_at).toISOString().split('T')[0]
          return createdDate === today
        })

        return {
          success: true,
          data: {
            count: todayOrders.length,
            orders: todayOrders,
          },
          metadata: { operation: 'report', entity: 'orders_today' },
        }
      }

      case 'subscriptions_active': {
        // db.query() expects a DatabaseQuery object (see IDatabaseService.ts)
        // Pagination settings must be passed via the 'pagination' property per interface
        const result = await db.query({
          collection: 'subscriptions',
          filters: [
            { field: 'status', operator: '==', value: 'active' },
          ]
        })

        if (!result.success) {
          return { success: false, error: 'Failed to fetch subscriptions' }
        }

        const subscriptions = result.data || []

        return {
          success: true,
          data: {
            count: subscriptions.length,
            subscriptions,
          },
          metadata: { operation: 'report', entity: 'subscriptions_active' },
        }
      }

      default:
        return {
          success: false,
          error: `Unsupported report type: ${report_type}`,
        }
    }
  } catch (error: any) {
    console.error('[RING API EXECUTOR] Error generating report:', error)
    return {
      success: false,
      error: error.message || 'Internal error during report generation',
    }
  }
}

/**
 * Execute parsed command from Anthropic
 * Routes to appropriate executor based on tool name
 * 
 * @param parsedCommand - Parsed command from Anthropic
 * @param userRole - User role for permission checks
 * @returns Execution result
 */
export async function executeCommand(
  parsedCommand: ParsedCommand,
  userRole: UserRole
): Promise<ExecutionResult> {
  const { toolName, toolInput } = parsedCommand

  switch (toolName) {
    case 'ring_crud':
      return executeRingCrud(toolInput, userRole)

    case 'ring_report':
      return executeRingReport(toolInput)

    case 'clarify':
      // Clarification requests don't execute - they're just returned to user
      return {
        success: true,
        data: { clarification: toolInput.question, suggestions: toolInput.suggestions },
        metadata: { operation: 'clarify', entity: 'none' },
      }

    default:
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
      }
  }
}
