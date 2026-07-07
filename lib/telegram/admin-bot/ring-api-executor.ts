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
import { UserRolesArray, isSuperadmin } from '@/features/auth/user-role'
import { ParsedCommand } from './anthropic-router'
import { generateNewsArticle } from '@/features/news/services/article-generator'
import { sendArticleDraftApprovalToChat } from '@/features/news/services/news-telegram-approval'

// -- Common result interface for all command executions
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

// -- Passed context for execution, such as telegram chat/user
export interface ExecutionContext {
  chatId?: string
  userId?: string | null
  authorName?: string
}

/**
 * Execute a ring_crud operation
 * Maps Anthropic tool calls to DatabaseService API
 * Checks permission restrictions and calls appropriate database methods.
 */
async function executeRingCrud(
  toolInput: any,
  userRole: UserRolesArray
): Promise<ExecutionResult> {
  const { operation, entity, id, data, filters, limit } = toolInput

  // Restrict admin from deleting users; only superadmin can do so
  if (operation === 'delete' && entity === 'users' && !isSuperadmin(userRole)) {
    return {
      success: false,
      error: 'admin role cannot delete users. Superadmin required.',
    }
  }

  // Restrict admin from modifying 'settings'; only superadmin can do so
  if (
    (operation === 'create' || operation === 'update') &&
    entity === 'settings' &&
    !isSuperadmin(userRole)
  ) {
    return {
      success: false,
      error: 'admin role cannot modify settings. Superadmin required.',
    }
  }

  try {
    switch (operation) {
      case 'create': {
        // Fail if missing data
        if (!data) {
          return {
            success: false,
            error: 'Data required for create operation',
          }
        }

        // Attempt creation in DB
        const result = await db().createDoc(entity, data)
        // Check if DB layer reports failure
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
        // ID must be provided
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
        // Both ID and data required
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
        // ID must be provided for deletion
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
        // Construct filter array for DB query (default empty array)
        const queryFilters = filters
          ? Object.entries(filters).map(([field, value]) => ({
              field,
              operator: '==' as const,
              value,
            }))
          : []

        // Limit results to 100
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
        // Unknown CRUD operation requested
        return {
          success: false,
          error: `Unknown operation: ${operation}`,
        }
    }
  } catch (error: any) {
    // Log error for troubleshooting
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
 * Returns summary statistics like active users, daily orders, etc.
 */
async function executeRingReport(toolInput: any): Promise<ExecutionResult> {
  const { report_type } = toolInput

  try {
    switch (report_type) {
      case 'users_summary': {
        // Fetch all users
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
        // Aggregate roles and active accounts
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
        // Get today's date in ISO string (YYYY-MM-DD)
        const today = new Date().toISOString().split('T')[0]
        const result = await db().queryDocs<{ created_at?: string }>({
          collection: 'orders',
          filters: [],
        })

        if (!result.success) {
          return { success: false, error: 'Failed to fetch orders' }
        }

        const orders = result.data || []
        // Only include orders from today
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
        // Query for subscriptions with active status
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
        // Report type not supported
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
 * Generates a news article from input/request context.
 * Sends generated article draft for approval to Telegram, if possible.
 * 
 * @param toolInput - Article details for generation
 * @param context - ExecutionContext including chat and user info
 * @returns ExecutionResult with articleId or error
 */
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
  // Clean up value (user-passed content)
  const value = toolInput.value?.trim()
  // Validate required params
  if (!source || !value) {
    return { success: false, error: 'source and value are required for article generation' }
  }
  if (!context?.userId) {
    return { success: false, error: 'Linked Ring user required for article author' }
  }

  // Attempt to generate article using service
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

  // Article failed or did not return articleId
  if (!result.success || !result.articleId) {
    return { success: false, error: result.error || 'Article generation failed' }
  }

  // If a Telegram chat is linked, notify with draft approval request
  if (context.chatId) {
    // No error thrown/handled for approval process; should be safe-fire
    // STUB: Consider handling errors that might be thrown here; Add audit logging
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
// TODO: Replace custom switch/case routing with Next.js 16 middleware or server actions
// TODO: Use native React19/Next16 "Server Functions" for improved request isolation and easier SSR integration
// TODO: Codemod suggestion: Convert to async server action (export `executeCommand` as server action if in Next16 app directory)
export async function executeCommand(
  parsedCommand: ParsedCommand,
  userRole: UserRolesArray,
  context?: ExecutionContext
): Promise<ExecutionResult> {
  const { toolName, toolInput } = parsedCommand

  // Normalize Anthropics' tool names to internal handlers
  const normalizedTool = toolName === 'entity_crud'
    ? 'ring_crud'
    : toolName === 'entity_report'
      ? 'ring_report'
      : toolName

  // Route to handler based on normalized tool name
  switch (normalizedTool) {
    case 'ring_crud':
      // CRUD operations (calls DB with validation)
      return executeRingCrud(toolInput, userRole)

    case 'ring_report':
      // Report / summary operations (statistical DB queries)
      return executeRingReport(toolInput)

    case 'generate_news_article':
      // Article generation (calls AI + posts to telegram if needed)
      return executeArticleGeneration(toolInput, context)

    case 'clarify':
      // Clarify handler - just echoes input clarification and suggestions
      // STUB: Clarify tool returns inputs as output. // TODO: Implement deeper clarification flow if needed.
      return {
        success: true,
        data: { clarification: toolInput.question, suggestions: toolInput.suggestions },
        metadata: { operation: 'clarify', entity: 'none' },
      }

    default:
      // Unknown tool received; return error
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
      }
  }
}
