#!/usr/bin/env ts-node
/**
 * ADMIN TELEGRAM BOT - Webhook Setup Script
 * One-time script to register webhook with Telegram API
 * 
 * Usage:
 *   npx ts-node scripts/setup-admin-bot-webhook.ts
 * 
 * Environment Variables Required:
 *   - ADMIN_BOT_TOKEN: Telegram bot token from @BotFather
 *   - ADMIN_BOT_WEBHOOK_SECRET: Random 256-bit secret for webhook validation
 *   - NEXT_PUBLIC_BASE_URL: Base URL for your Ring Platform instance
 * 
 * Truth Lens:
 *   - @legiox/telegram_bot_api_specialist.json
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') })

const BOT_TOKEN = process.env.ADMIN_BOT_TOKEN
const WEBHOOK_SECRET = process.env.ADMIN_BOT_WEBHOOK_SECRET
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

const WEBHOOK_PATH = '/api/telegram/admin-bot/webhook'
const WEBHOOK_URL = `${BASE_URL}${WEBHOOK_PATH}`

/**
 * Set webhook for Telegram bot
 */
async function setWebhook() {
  if (!BOT_TOKEN) {
    console.error('❌ ADMIN_BOT_TOKEN not configured in .env.local')
    process.exit(1)
  }

  if (!WEBHOOK_SECRET) {
    console.error('❌ ADMIN_BOT_WEBHOOK_SECRET not configured in .env.local')
    process.exit(1)
  }

  console.log('🤖 Ring Platform Admin Bot - Webhook Setup\n')
  console.log(`📍 Webhook URL: ${WEBHOOK_URL}`)
  console.log(`🔐 Secret Token: ${WEBHOOK_SECRET.slice(0, 8)}...`)
  console.log('')

  try {
    // Set webhook
    const setResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          secret_token: WEBHOOK_SECRET,
          max_connections: 40,
          allowed_updates: ['message'],
          drop_pending_updates: true,
        }),
      }
    )

    const setResult = await setResponse.json()

    if (!setResult.ok) {
      console.error('❌ Failed to set webhook:')
      console.error(JSON.stringify(setResult, null, 2))
      process.exit(1)
    }

    console.log('✅ Webhook set successfully!')
    console.log('')

    // Get webhook info to verify
    const infoResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`,
      { method: 'GET' }
    )

    const infoResult = await infoResponse.json()

    if (infoResult.ok) {
      console.log('📋 Webhook Info:')
      console.log(`   URL: ${infoResult.result.url}`)
      console.log(`   Has Secret Token: ${infoResult.result.has_custom_certificate ? 'Yes' : 'No'}`)
      console.log(`   Max Connections: ${infoResult.result.max_connections}`)
      console.log(`   Pending Updates: ${infoResult.result.pending_update_count}`)
      console.log(
        `   Last Error: ${infoResult.result.last_error_message || 'None'}`
      )
      console.log('')
    }

    // Get bot info
    const meResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getMe`,
      { method: 'GET' }
    )

    const meResult = await meResponse.json()

    if (meResult.ok) {
      console.log('🤖 Bot Info:')
      console.log(`   Username: @${meResult.result.username}`)
      console.log(`   Name: ${meResult.result.first_name}`)
      console.log(`   ID: ${meResult.result.id}`)
      console.log('')
    }

    console.log('✅ Setup complete!')
    console.log('')
    console.log('📝 Next steps:')
    console.log('   1. Add your Telegram Chat ID to your ADMIN/SUPERADMIN user profile')
    console.log('   2. Find your Chat ID by messaging @userinfobot on Telegram')
    console.log('   3. Paste your numeric Chat ID in your profile settings')
    console.log(`   4. Start chatting with @${meResult.result?.username || 'your bot'}`)
    console.log('')
  } catch (error: any) {
    console.error('❌ Error setting webhook:', error.message)
    process.exit(1)
  }
}

/**
 * Delete webhook (for cleanup)
 */
async function deleteWebhook() {
  if (!BOT_TOKEN) {
    console.error('❌ ADMIN_BOT_TOKEN not configured in .env.local')
    process.exit(1)
  }

  console.log('🗑️  Deleting webhook...\n')

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drop_pending_updates: true }),
      }
    )

    const result = await response.json()

    if (!result.ok) {
      console.error('❌ Failed to delete webhook:')
      console.error(JSON.stringify(result, null, 2))
      process.exit(1)
    }

    console.log('✅ Webhook deleted successfully!')
  } catch (error: any) {
    console.error('❌ Error deleting webhook:', error.message)
    process.exit(1)
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'set'

  switch (command) {
    case 'set':
      await setWebhook()
      break

    case 'delete':
      await deleteWebhook()
      break

    case 'info':
      // Get webhook info only
      if (!BOT_TOKEN) {
        console.error('❌ ADMIN_BOT_TOKEN not configured')
        process.exit(1)
      }

      const response = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
      )
      const result = await response.json()
      console.log(JSON.stringify(result, null, 2))
      break

    default:
      console.log('Usage:')
      console.log('  npx ts-node scripts/setup-admin-bot-webhook.ts [command]')
      console.log('')
      console.log('Commands:')
      console.log('  set     - Set webhook (default)')
      console.log('  delete  - Delete webhook')
      console.log('  info    - Get webhook info')
      break
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
