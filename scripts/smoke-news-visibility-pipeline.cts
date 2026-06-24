/**
 * Smoke: news visibility SSOT — role ladder, by-id gate, permissions (no DB required).
 *
 * Usage:
 *   npx tsx scripts/smoke-news-visibility-pipeline.cts
 */

import { UserRole } from '@/features/auth/user-role'
import {
  buildNewsVisibilityFilters,
  canViewNewsArticle,
  getAllowedNewsVisibilityValues,
} from '@/features/news/lib/news-visibility-filter'
import {
  assertNewsVisibilityPatch,
  canCreateNewsArticle,
  canSetNewsVisibility,
} from '@/features/news/lib/news-permissions'

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

console.log('smoke-news-visibility-pipeline')

const visitorAllowed = getAllowedNewsVisibilityValues(UserRole.visitor)
ok(
  'visitor list allows public+site-wide only',
  Array.isArray(visitorAllowed) &&
    visitorAllowed.length === 2 &&
    visitorAllowed.includes('public') &&
    visitorAllowed.includes('site-wide'),
)

const subscriberAllowed = getAllowedNewsVisibilityValues(UserRole.subscriber)
ok(
  'subscriber list allows public+subscriber+site-wide',
  Array.isArray(subscriberAllowed) &&
    subscriberAllowed.length === 3 &&
    subscriberAllowed.includes('subscriber'),
)

ok('admin list filters unrestricted', getAllowedNewsVisibilityValues(UserRole.admin) === null)

ok(
  'subscriber blocked on member article by-id',
  !canViewNewsArticle(
    { visibility: 'member', authorId: 'a1' },
    { userRole: UserRole.subscriber, userId: 'u1' },
  ),
)

ok(
  'member can view member article by-id',
  canViewNewsArticle(
    { visibility: 'member', authorId: 'a1' },
    { userRole: UserRole.member, userId: 'u1' },
  ),
)

ok(
  'blog-only visible to author',
  canViewNewsArticle(
    { visibility: 'blog-only', authorId: 'u1' },
    { userRole: UserRole.member, userId: 'u1' },
  ),
)

ok(
  'blog-only hidden from non-author member',
  !canViewNewsArticle(
    { visibility: 'blog-only', authorId: 'a1' },
    { userRole: UserRole.member, userId: 'u2' },
  ),
)

ok(
  'site-wide visible to visitor',
  canViewNewsArticle(
    { visibility: 'site-wide', authorId: 'a1' },
    { userRole: UserRole.visitor },
  ),
)

ok(
  'confidential blocked for member by-id',
  !canViewNewsArticle(
    { visibility: 'confidential', authorId: 'a1' },
    { userRole: UserRole.member, userId: 'u1' },
  ),
)

const subscriberFilters = buildNewsVisibilityFilters(UserRole.subscriber)
ok(
  'subscriber DB filters exclude confidential',
  subscriberFilters.some(
    (f) => f.field === 'visibility' && f.operator === '!=' && f.value === 'confidential',
  ),
)

ok('member can create news', canCreateNewsArticle(UserRole.member))
ok('subscriber cannot create news', !canCreateNewsArticle(UserRole.subscriber))
ok('member cannot set confidential visibility', !canSetNewsVisibility(UserRole.member, 'confidential'))
ok('admin can set site-wide visibility', canSetNewsVisibility(UserRole.admin, 'site-wide'))
ok('superadmin can set site-wide visibility', canSetNewsVisibility(UserRole.superadmin, 'site-wide'))

try {
  assertNewsVisibilityPatch(UserRole.subscriber, { visibility: 'confidential' })
  ok('subscriber visibility escalation throws', false)
} catch {
  ok('subscriber visibility escalation throws', true)
}

console.log(`\nResult: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
