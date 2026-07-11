#!/usr/bin/env node
/**
 * Assert every ADMIN_NAV_MESSAGE_PATHS value resolves to a string in en/uk/ru.
 * Run: node scripts/verify-admin-nav-paths.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')
const locales = ['en', 'uk', 'ru']

// Mirror of features/admin/admin-nav-message-paths.ts (no TS import in plain node script)
const ADMIN_NAV_MESSAGE_PATHS = {
  matcher: 'matcher.nav',
  settings: 'settings.nav',
  processes: 'processes.nav',
  subscriptions: 'subscriptions.nav',
  fraudDesk: 'fraudDesk.nav',
  verification: 'verificationQueue.nav',
  web3: 'web3.nav',
  dashboard: 'dashboard',
  users: 'users',
  news: 'news',
  dao: 'dao',
  analytics: 'analytics',
  moderation: 'moderation',
  performance: 'performance',
  security: 'security',
  store: 'store',
  refcodes: 'refcodes',
  emailInbox: 'emailInbox',
}

function resolvePath(messages, dottedPath) {
  const parts = dottedPath.split('.')
  let cur = messages
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[part]
  }
  return cur
}

let failed = false

for (const loc of locales) {
  const file = path.join(repoRoot, 'locales', loc, 'modules/admin.json')
  const messages = JSON.parse(fs.readFileSync(file, 'utf8'))

  for (const [labelKey, messagePath] of Object.entries(ADMIN_NAV_MESSAGE_PATHS)) {
    const value = resolvePath(messages, messagePath)
    if (typeof value !== 'string' || value.length === 0) {
      console.error(`FAIL [${loc}] ${labelKey} → ${messagePath}: ${JSON.stringify(value)}`)
      failed = true
    }
  }

  // Obsolete *Nav keys must be gone
  for (const obsolete of [
    'matcherNav',
    'settingsNav',
    'processesNav',
    'subscriptionsNav',
    'fraudDeskNav',
    'verificationNav',
    'web3Nav',
  ]) {
    if (obsolete in messages) {
      console.error(`FAIL [${loc}] obsolete key still present: ${obsolete}`)
      failed = true
    }
  }

  // web3 hub shell keys
  for (const key of ['nav', 'title', 'subtitle']) {
    const value = messages.web3?.[key]
    if (typeof value !== 'string' || value.length === 0) {
      console.error(`FAIL [${loc}] web3.${key} missing`)
      failed = true
    }
  }
}

if (failed) {
  process.exit(1)
}

console.log(`OK: ${Object.keys(ADMIN_NAV_MESSAGE_PATHS).length} nav paths × ${locales.length} locales`)
