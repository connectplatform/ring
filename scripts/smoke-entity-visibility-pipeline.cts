/**
 * Smoke: entity visibility SSOT — role ladder + by-id gate (no DB required).
 *
 * Usage:
 *   npx tsx scripts/smoke-entity-visibility-pipeline.cts
 */

import { UserRole } from '@/features/auth/user-role'
import {
  canViewEntity,
  getAllowedEntityVisibilityValues,
} from '@/features/entities/lib/entity-visibility-filter'
import {
  assertEntityVisibilityPatch,
  canSetEntityVisibility,
} from '@/features/entities/lib/entity-permissions'

let pass = 0
let fail = 0

function ok(name: string, cond: boolean) {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name}`)
  }
}

console.log('smoke-entity-visibility-pipeline')

const subscriberAllowed = getAllowedEntityVisibilityValues(UserRole.subscriber)
ok(
  'subscriber list allows public+subscriber only',
  Array.isArray(subscriberAllowed) &&
    subscriberAllowed.length === 2 &&
    subscriberAllowed.includes('public') &&
    subscriberAllowed.includes('subscriber'),
)

ok(
  'subscriber blocked on member entity by-id',
  !canViewEntity({ visibility: 'member', isConfidential: false }, { userRole: UserRole.subscriber }),
)

ok(
  'member can view member entity by-id',
  canViewEntity({ visibility: 'member', isConfidential: false }, { userRole: UserRole.member }),
)

ok('member cannot PATCH visibility to confidential', !canSetEntityVisibility(UserRole.member, 'confidential'))

try {
  assertEntityVisibilityPatch(UserRole.subscriber, { visibility: 'confidential' })
  ok('subscriber visibility escalation throws', false)
} catch {
  ok('subscriber visibility escalation throws', true)
}

console.log(`\nResult: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
