/**
 * ADMIN TELEGRAM BOT - Response Formatter
 * Formats execution results into Telegram-safe HTML messages
 * 
 * Truth Lens:
 * - @legiox/telegram_bot_api_specialist.json
 * 
 * Features:
 * - HTML formatting for rich Telegram messages
 * - Truncation for large datasets
 * - Emoji indicators for status
 */

import { ExecutionResult } from './ring-api-executor'
import { ParsedCommand } from './anthropic-router'

const MAX_MESSAGE_LENGTH = 4000 // Telegram limit is 4096, leave buffer

/**
 * Format execution result for Telegram message
 * 
 * @param result - Execution result from ring-api-executor
 * @param parsedCommand - Original parsed command for context
 * @returns HTML-formatted message for Telegram
 */
export function formatResponse(
  result: ExecutionResult,
  parsedCommand: ParsedCommand
): string {
  const { toolName, toolInput } = parsedCommand

  // Handle clarification requests
  if (toolName === 'clarify') {
    const question = result.data?.clarification || toolInput.question
    const suggestions = result.data?.suggestions || toolInput.suggestions || []

    let message = `❓ <b>Clarification Needed</b>\n\n${escapeHtml(question)}`

    if (suggestions.length > 0) {
      message += '\n\n<b>Suggestions:</b>'
      suggestions.forEach((suggestion: string, index: number) => {
        message += `\n${index + 1}. ${escapeHtml(suggestion)}`
      })
    }

    return message
  }

  // Handle errors
  if (!result.success) {
    return `❌ <b>Error</b>\n\n${escapeHtml(result.error || 'Unknown error')}`
  }

  // Handle successful operations
  const { operation, entity, recordsAffected } = result.metadata || {}

  switch (operation) {
    case 'create':
      return formatCreateResponse(result.data, entity!)

    case 'read':
      return formatReadResponse(result.data, entity!)

    case 'update':
      return formatUpdateResponse(result.data, entity!)

    case 'delete':
      return formatDeleteResponse(result.data, entity!)

    case 'list':
      return formatListResponse(result.data, entity!, recordsAffected!)

    case 'report':
      return formatReportResponse(result.data, entity!)

    default:
      return `✅ <b>Success</b>\n\nOperation completed successfully.`
  }
}

/**
 * Format CREATE operation response
 */
function formatCreateResponse(data: any, entity: string): string {
  const id = data?.id || 'unknown'
  let message = `✅ <b>Created ${entity}</b>\n\n`
  message += `<b>ID:</b> <code>${escapeHtml(id)}</code>\n`

  // Add key fields based on entity type
  if (data?.data) {
    const fields = extractKeyFields(data.data, entity)
    Object.entries(fields).forEach(([key, value]) => {
      message += `<b>${capitalizeFirst(key)}:</b> ${escapeHtml(String(value))}\n`
    })
  }

  return truncateMessage(message)
}

/**
 * Format READ operation response
 */
function formatReadResponse(data: any, entity: string): string {
  if (!data) {
    return `❌ <b>Not Found</b>\n\nNo ${entity} record found.`
  }

  let message = `📄 <b>${capitalizeFirst(entity)} Details</b>\n\n`
  message += `<b>ID:</b> <code>${escapeHtml(data.id || 'unknown')}</code>\n`

  if (data.data) {
    const fields = extractKeyFields(data.data, entity)
    Object.entries(fields).forEach(([key, value]) => {
      message += `<b>${capitalizeFirst(key)}:</b> ${escapeHtml(String(value))}\n`
    })
  }

  if (data.created_at) {
    message += `\n<b>Created:</b> ${formatDate(data.created_at)}`
  }
  if (data.updated_at) {
    message += `\n<b>Updated:</b> ${formatDate(data.updated_at)}`
  }

  return truncateMessage(message)
}

/**
 * Format UPDATE operation response
 */
function formatUpdateResponse(data: any, entity: string): string {
  const id = data?.id || 'unknown'
  let message = `✏️ <b>Updated ${entity}</b>\n\n`
  message += `<b>ID:</b> <code>${escapeHtml(id)}</code>\n\n`
  message += `Record updated successfully.`

  return truncateMessage(message)
}

/**
 * Format DELETE operation response
 */
function formatDeleteResponse(data: any, entity: string): string {
  const id = data?.id || 'unknown'
  let message = `🗑 <b>Deleted ${entity}</b>\n\n`
  message += `<b>ID:</b> <code>${escapeHtml(id)}</code>\n\n`
  message += `Record deleted successfully.`

  return truncateMessage(message)
}

/**
 * Format LIST operation response
 */
function formatListResponse(data: any[], entity: string, count: number): string {
  let message = `📋 <b>${capitalizeFirst(entity)} List</b>\n\n`
  message += `<b>Total:</b> ${count} record(s)\n\n`

  if (count === 0) {
    message += `No ${entity} found.`
    return message
  }

  // Show first 5 records
  const limit = Math.min(5, data.length)
  for (let i = 0; i < limit; i++) {
    const record = data[i]
    message += `<b>${i + 1}.</b> <code>${escapeHtml(record.id || 'unknown')}</code>`

    if (record.data) {
      const fields = extractKeyFields(record.data, entity)
      const firstField = Object.entries(fields)[0]
      if (firstField) {
        message += ` - ${escapeHtml(String(firstField[1]))}`
      }
    }

    message += '\n'
  }

  if (data.length > limit) {
    message += `\n... and ${data.length - limit} more record(s).`
  }

  return truncateMessage(message)
}

/**
 * Format REPORT operation response
 */
function formatReportResponse(data: any, reportType: string): string {
  let message = `📊 <b>${capitalizeFirst(reportType.replace(/_/g, ' '))}</b>\n\n`

  if (reportType === 'users_summary') {
    message += `<b>Total Users:</b> ${data.total}\n`
    message += `<b>Active Users:</b> ${data.active}\n\n`
    message += `<b>By Role:</b>\n`
    Object.entries(data.by_role).forEach(([role, count]) => {
      message += `  • ${capitalizeFirst(role)}: ${count}\n`
    })
  } else if (reportType === 'orders_today') {
    message += `<b>Orders Today:</b> ${data.count}\n`
  } else if (reportType === 'subscriptions_active') {
    message += `<b>Active Subscriptions:</b> ${data.count}\n`
  } else {
    message += `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`
  }

  return truncateMessage(message)
}

/**
 * Extract key fields based on entity type
 */
function extractKeyFields(data: any, entity: string): Record<string, any> {
  const commonFields = ['name', 'email', 'title', 'status', 'role']

  const entitySpecificFields: Record<string, string[]> = {
    users: ['email', 'role', 'name', 'accountStatus'],
    products: ['name', 'price', 'category', 'status'],
    orders: ['status', 'total', 'userId'],
    subscriptions: ['status', 'plan_type', 'current_period_end'],
    places: ['name', 'place_type', 'city', 'subscription_status'],
    pets: ['name', 'pet_type', 'breed', 'age_years'],
  }

  const fieldsToExtract = entitySpecificFields[entity] || commonFields

  const extracted: Record<string, any> = {}
  fieldsToExtract.forEach((field) => {
    if (data[field] !== undefined && data[field] !== null) {
      extracted[field] = data[field]
    }
  })

  return extracted
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

/**
 * Capitalize first letter of string
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Format date to readable string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Truncate message if too long
 */
function truncateMessage(message: string): string {
  if (message.length <= MAX_MESSAGE_LENGTH) {
    return message
  }

  const truncated = message.slice(0, MAX_MESSAGE_LENGTH - 50)
  return truncated + '\n\n... (message truncated)'
}
