/**
 * ADMIN TELEGRAM BOT - Webhook Route
 * Receives Telegram webhook updates for Admin Bot
 * 
 * Truth Lens:
 * - @legiox/telegram_bot_api_specialist.json
 * - @legiox/prompt-injection-prevention-specialist.json
 * - @legiox/ring-backend-administrator.json
 * 
 * Security Layers (PALADIN):
 * 1. Webhook secret token validation
 * 2. Telegram Chat ID whitelist check
 * 3. Spotlighting in Anthropic router
 * 4. Output validation before execution
 * 5. Full audit logging
 */

import { NextRequest, NextResponse, connection } from 'next/server'
import { validateWebhookSecret, sendMessage } from '@/lib/telegram/admin-bot/bot-config'
import { isWhitelisted, getUserIdFromTelegramId } from '@/lib/telegram/admin-bot/whitelist'
import { parseAdminCommand, validateToolInput } from '@/lib/telegram/admin-bot/anthropic-router'
import { executeCommand } from '@/lib/telegram/admin-bot/ring-api-executor'
import { formatResponse } from '@/lib/telegram/admin-bot/response-formatter'
import { logInteraction, logFailedRequest } from '@/lib/telegram/admin-bot/audit-logger'
import { UserRole } from '@/features/auth/types'
import { getDatabaseService, initializeDatabase } from '@/lib/database/DatabaseService'
import { handleNewsCallback } from '@/lib/telegram/admin-bot/news-callback-handler'

interface TelegramUpdate {
  update_id: number
  callback_query?: {
    id: string
    from: { id: number }
    message?: { chat: { id: number } }
    data?: string
  }
  message?: {
    message_id: number
    from: {
      id: number
      first_name: string
      last_name?: string
      username?: string
    }
    chat: {
      id: number
      type: string
    }
    date: number
    text?: string
  }
}

/**
 * POST /api/telegram/admin-bot/webhook
 * Handles incoming Telegram webhook updates
 * 
 * CRITICAL: Always returns 200 to prevent Telegram retries
 * Errors are logged but silently dropped to avoid leaking information
 */
export async function POST(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    // PALADIN Layer 1: Verify webhook secret token
    const secret = request.headers.get('x-telegram-bot-api-secret-token')
    if (!validateWebhookSecret(secret)) {
      await logFailedRequest(null, null, 'Invalid webhook secret token')
      return NextResponse.json({ ok: true }, { status: 200 }) // Silent 200
    }

    // Parse Telegram update
    const update: TelegramUpdate = await request.json()

    if (update.callback_query?.data?.startsWith('news_')) {
      const cq = update.callback_query
      const chatId = cq.message?.chat?.id?.toString() ?? cq.from.id.toString()
      const whitelisted = await isWhitelisted(chatId)
      if (!whitelisted) {
        return NextResponse.json({ ok: true }, { status: 200 })
      }
      handleNewsCallback(chatId, cq.data, cq.id).catch(console.error)
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const chatId = update.message?.chat?.id?.toString()
    const text = update.message?.text

    // Ignore non-text messages
    if (!chatId || !text) {
      return NextResponse.json({ ok: true }, { status: 200 }) // Silent 200
    }

    // PALADIN Layer 2: Whitelist check - is sender an ADMIN/SUPERADMIN?
    const whitelisted = await isWhitelisted(chatId)
    if (!whitelisted) {
      await logFailedRequest(chatId, text, 'Telegram ID not whitelisted')
      return NextResponse.json({ ok: true }, { status: 200 }) // Silent 200
    }

    // Get user ID for audit logging and permission checks
    const userId = await getUserIdFromTelegramId(chatId)

    // Queue async processing (respond to Telegram within 200ms)
    processAdminCommand(chatId, text, userId).catch((error) => {
      console.error('[ADMIN BOT WEBHOOK] Error processing command:', error)
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error: any) {
    console.error('[ADMIN BOT WEBHOOK] Error handling webhook:', error)
    await logFailedRequest(null, null, `Webhook error: ${error.message}`)
    return NextResponse.json({ ok: true }, { status: 200 }) // Always 200
  }
}

/**
 * Process admin command asynchronously
 * Fire-and-forget to avoid Telegram timeout (5s limit)
 * 
 * @param chatId - Telegram Chat ID
 * @param text - Message text from user
 * @param userId - Ring Platform user ID (for permission checks)
 */
async function processAdminCommand(
  chatId: string,
  text: string,
  userId: string | null
): Promise<void> {
  let parsedCommand = null
  let executionResult = null

  try {
    // Get user role for permission checks
    let userRole = UserRole.ADMIN // Default to ADMIN
    if (userId) {
      await initializeDatabase()
      const db = getDatabaseService()
      const userResult = await db.findById('users', userId)
      if (userResult.success && userResult.data?.data?.role) {
        userRole = userResult.data.data.role as UserRole
      }
    }

    // PALADIN Layer 3: Parse command via Anthropic (with spotlighting)
    parsedCommand = await parseAdminCommand(text, chatId)

    // PALADIN Layer 4: Validate tool input
    if (!validateToolInput(parsedCommand.toolName, parsedCommand.toolInput)) {
      executionResult = {
        success: false,
        error: 'Invalid command input. Please rephrase your request.',
      }
      await sendMessage(chatId, formatResponse(executionResult, parsedCommand))
      await logInteraction(chatId, userId, text, parsedCommand, executionResult)
      return
    }

    // Execute command
    executionResult = await executeCommand(parsedCommand, userRole)

    // Format and send response
    const responseMessage = formatResponse(executionResult, parsedCommand)
    await sendMessage(chatId, responseMessage)

    // PALADIN Layer 5: Audit logging
    await logInteraction(chatId, userId, text, parsedCommand, executionResult)
  } catch (error: any) {
    console.error('[ADMIN BOT] Error processing command:', error)

    // Send error message to user
    const errorMessage = `❌ <b>Internal Error</b>\n\nFailed to process command: ${error.message || 'Unknown error'}`
    await sendMessage(chatId, errorMessage)

    // Log error
    const errorResult = {
      success: false,
      error: error.message || 'Unknown error',
    }
    await logInteraction(chatId, userId, text, parsedCommand, errorResult)
  }
}

/**
 * GET /api/telegram/admin-bot/webhook
 * Health check endpoint
 */
export async function GET() {
  await connection()

  return NextResponse.json({
    status: 'ok',
    service: 'admin-telegram-bot',
    version: '1.0.0',
  })
}
