/**
 * admin TELEGRAM BOT - Ring API Executor
 * Executes Ring API operations from parsed Anthropic tool calls
 * 
 * Truth Lens:
 * - @legiox/ring-backend-administrator.json
 * - @legiox/postgres-db-specialist.json
 * 
 * Security:
 * - admin can CRUD on most entities, restricted from users delete and settings write
 * - SUPERadmin has full access
 * - All operations logged to audit table
 */

import { db } from '@/lib/database'
import { UserRole } from '@/features/auth/types'
import { ParsedCommand } from './anthropic-router'
import { generateNewsArticle } from '@/features/news/services/article-generator'
import { sendArticleDraftApprovalToChat } from '@/features/news/services/news-telegram-approval'

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

export interface ExecutionContext {
  chatId?: string
  userId?: string | null
  authorName?: string
}

/**
 * Execute a ring_crud operation
 * Maps Anthropic tool calls to DatabaseService API
 * 
 * @param toolInput - Parsed tool input from Anthropic
 * @param userRole - User role (admin or SUPERADMIN)
 * @returns Execution result with data or error
 */
async function executeRingCrud(
  toolInput: any,
  userRole: UserRole
): Promise<ExecutionResult> {
  const { operation, entity, id, data, filters, limit } = toolInput

  if (operation === 'delete' && entity === 'users' && userRole !== UserRole.superadmin) {
    return {
      success: false,
      error: 'admin role cannot delete users. SUPERadmin required.',
    }
  }

  if (
    (operation === 'create' || operation === 'update') &&
    entity === 'settings' &&
    userRole !== UserRole.superadmin
  ) {
    return {
      success: false,
      error: 'admin role cannot modify settings. SUPERadmin required.',
    }
  }

  try {
    switch (operation) {
      case 'create': {
        if (!data) {
          return {
            success: false,
            error: 'Data required for create operation',
          }
        }

        const result = await db().createDoc(entity, data)

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

        const result = await db().findDocById(entity, id)

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

        const result = await db().updateDoc(entity, id, data)

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

        const result = await db().deleteDoc(entity, id)

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

        const result = await db().queryDocs({
          collection: entity,
          filters: queryFilters,
          orderBy: [{ field: 'created_at', direction: 'desc' }],
          pagination: { limit: Math.min(limit || 10, 100) },
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
  const { report_type } = toolInput

  try {
    switch (report_type) {
      case 'users_summary': {
        const result = await db().queryDocs<{
          role?: string
          accountStatus?: string
        }>({
          collection: 'users',
          filters: [],
        })

        if (!result.success) {
          return { success: false, error: 'Failed to fetch users' }
        }

        const users = result.data || []
        const summary = {
          total: users.length,
          by_role: users.reduce((acc: Record<string, number>, user) => {
            const role = user.role || 'visitor'
            acc[role] = (acc[role] || 0) + 1
            return acc
          }, {}),
          active: users.filter((u) => u.accountStatus === 'ACTIVE').length,
        }

        return {
          success: true,
          data: summary,
          metadata: { operation: 'report', entity: 'users_summary' },
        }
      }

      case 'orders_today': {
        const today = new Date().toISOString().split('T')[0]
        const result = await db().queryDocs<{ created_at?: string }>({
          collection: 'orders',
          filters: [],
        })

        if (!result.success) {
          return { success: false, error: 'Failed to fetch orders' }
        }

        const orders = result.data || []
        const todayOrders = orders.filter((order) => {
          const createdDate = new Date(order.created_at || '').toISOString().split('T')[0]
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
        const result = await db().queryDocs({
          collection: 'subscriptions',
          filters: [
            { field: 'status', operator: '==', value: 'active' },
          ],
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

async function executeArticleGeneration(
  toolInput: {
    source?: 'url' | 'search' | 'text'
    value?: string
    instruction?: string
    enableAudio?: boolean
    enableImage?: boolean
  },
  context?: ExecutionContext
): Promise<ExecutionResult> {
  const source = toolInput.source
  const value = toolInput.value?.trim()
  if (!source || !value) {
    return { success: false, error: 'source and value are required for article generation' }
  }
  if (!context?.userId) {
    return { success: false, error: 'Linked Ring user required for article author' }
  }

  const result = await generateNewsArticle({
    source,
    value,
    instruction: toolInput.instruction,
    author: {
      id: context.userId,
      name: context.authorName || 'Telegram Admin',
    },
    enableAudio: toolInput.enableAudio,
    enableImage: toolInput.enableImage,
  })

  if (!result.success || !result.articleId) {
    return { success: false, error: result.error || 'Article generation failed' }
  }

  if (context.chatId) {
    await sendArticleDraftApprovalToChat(context.chatId, result.articleId, {
      title: result.title || 'Untitled draft',
      locale: result.locale || 'en',
      featuredImage: result.featuredImage,
      audioUrl: result.audioUrl,
    })
  }

  return {
    success: true,
    data: result,
    metadata: { operation: 'article_generation', entity: 'news', recordsAffected: 1 },
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
  userRole: UserRole,
  context?: ExecutionContext
): Promise<ExecutionResult> {
  const { toolName, toolInput } = parsedCommand
  const normalizedTool = toolName === 'entity_crud'
    ? 'ring_crud'
    : toolName === 'entity_report'
      ? 'ring_report'
      : toolName

  switch (normalizedTool) {
    case 'ring_crud':
      return executeRingCrud(toolInput, userRole)

    case 'ring_report':
      return executeRingReport(toolInput)

    case 'generate_news_article':
      return executeArticleGeneration(toolInput, context)

    case 'clarify':
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
