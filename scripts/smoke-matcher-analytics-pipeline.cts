#!/usr/bin/env npx tsx
/**
 * Smoke: matcher analytics type helpers (no DB — server-only modules require Next runtime).
 * Full pipeline: apply migration 027, create opportunity with LLM, visit /admin/matcher.
 * Run: npx tsx scripts/smoke-matcher-analytics-pipeline.cts
 */
import {
  parseMatcherTimeframe,
  MATCHER_TIMEFRAMES,
} from '../features/admin/matcher/types/matcher-analytics'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error('FAIL:', message)
    process.exit(1)
  }
}

assert(parseMatcherTimeframe('7d') === '7d', 'parseMatcherTimeframe default')
assert(parseMatcherTimeframe('invalid') === '7d', 'parseMatcherTimeframe fallback')
assert(parseMatcherTimeframe('30d') === '30d', 'parseMatcherTimeframe 30d')
assert(parseMatcherTimeframe('90d') === '90d', 'parseMatcherTimeframe 90d')
assert(MATCHER_TIMEFRAMES.length === 4, 'four timeframe options')

console.log('PASS smoke-matcher-analytics-pipeline (type helpers)')
console.log('NOTE: apply data/migrations/027_event_log_schema.sql for full event persistence')
