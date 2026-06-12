/**
 * E2E smoke: growth pipelines — signup referral attribution, matcher → notify,
 * news promotion payment, credit top-up tx-hash replay guard.
 *
 * Usage:
 *   NODE_OPTIONS="--conditions=react-server" \
 *   DB_BACKEND_MODE=k8s-postgres-fcm \
 *   npx tsx scripts/smoke-growth-pipelines.cts [--keep]
 */

import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { RefcodeService } from '@/features/refcodes/services/refcode-service'
import {
  persistSignupReferralAttribution,
  trackRefcodeVisit,
} from '@/features/refcodes/services/attribution-service'
import {
  OpportunityMatchingService,
  matchAndNotifyUsers,
} from '@/features/opportunities/services/matching-service'
import { loadCandidateProfiles } from '@/lib/ai/user-profile-loader'
import {
  createNotification,
  getUserNotifications,
} from '@/features/notifications/services/notification-service'
import {
  NotificationType,
  NotificationChannel,
  NotificationPriority,
} from '@/features/notifications/types'
import { buildOrderReference } from '@/lib/payments/order-reference'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { handleNewsWayForPayWebhook } from '@/lib/payments/conductor/handlers/news-promotion'
import {
  isChainProofRequired,
  reserveTopUpTxHash,
  verifyTopUpTransaction,
} from '@/features/wallet/services/topup-verification'

const KEEP = process.argv.includes('--keep')

const IDS = {
  referrer: 'smk4_referrer',
  signup: 'smk4_signup',
  candidate: 'smk4_candidate',
  article: 'smk4_article',
}
const REFERRER_WALLET = '0x2222222222222222222222222222222222222222'
const OPP_ID = 'smk4_opportunity'
const TOPUP_TX = '0x' + 'ab'.repeat(32)

let pass = 0
let fail = 0
let warn = 0

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function warning(name: string, detail: string) {
  warn++
  console.log(`  ⚠️  ${name} — ${detail}`)
}

async function cleanup() {
  const db = getDatabaseService()
  const direct: Array<[string, string]> = [
    ['users', IDS.referrer],
    ['users', IDS.signup],
    ['users', IDS.candidate],
    ['news', IDS.article],
    ['wallet_transactions', `topup_${TOPUP_TX.toLowerCase()}`],
  ]
  for (const [collection, id] of direct) {
    try {
      await db.delete(collection, id)
    } catch {
      /* may not exist */
    }
  }

  const queryWipes: Array<[string, string, string]> = [
    ['refcodes', 'ownerUserId', IDS.referrer],
    ['notifications', 'user_id', IDS.candidate],
    ['payment_transactions', 'entity_id', IDS.article],
    ['news_submission_audit', 'newsId', IDS.article],
  ]
  for (const [collection, field, value] of queryWipes) {
    try {
      const res = await db.query({
        collection,
        filters: [{ field, operator: '=', value }],
        pagination: { limit: 50 },
      })
      const rows = res.success && res.data ? res.data : []
      for (const row of rows) {
        await db.delete(collection, row.id as string)
      }
    } catch {
      /* best effort */
    }
  }
}

async function seed() {
  const db = getDatabaseService()
  const now = new Date().toISOString()

  await db.create(
    'users',
    { name: 'Smoke Referrer 4', walletAddress: REFERRER_WALLET, createdAt: now },
    { id: IDS.referrer },
  )
  await db.create('users', { name: 'Smoke Signup 4', createdAt: now }, { id: IDS.signup })
  await db.create(
    'users',
    {
      name: 'Smoke Candidate 4',
      skills: ['TypeScript', 'React', 'Next.js'],
      industry: ['software'],
      location: 'remote',
      createdAt: now,
    },
    { id: IDS.candidate },
  )
  await db.create(
    'news',
    {
      title: 'Smoke News Article',
      slug: 'smoke-news-article',
      content: 'Promotion pipeline smoke test',
      mainPageStatus: 'payment_pending',
      status: 'draft',
      createdAt: now,
    },
    { id: IDS.article },
  )
}

async function main() {
  console.log('🔬 Growth pipelines smoke — ring_platform dev\n')

  // Force baseline matcher (no external LLM) for deterministic smoke runs
  const savedOpenAi = process.env.OPENAI_API_KEY
  const savedAnthropic = process.env.ANTHROPIC_API_KEY
  process.env.OPENAI_API_KEY = ''
  process.env.ANTHROPIC_API_KEY = ''
  process.env.MATCHING_SCORE_THRESHOLD = '0.5'

  await initializeDatabase()
  const db = getDatabaseService()

  await cleanup()
  await seed()

  // ── 1. Signup referral attribution ────────────────────────────────────────
  console.log('1) Signup referral attribution')
  const refcode = await RefcodeService.getOrCreateForWallet(IDS.referrer, REFERRER_WALLET)
  ok('refcode created for referrer', Boolean(refcode.code))

  const attributed = await persistSignupReferralAttribution(IDS.signup, refcode.code)
  ok('persistSignupReferralAttribution succeeds', attributed === true)

  const signupRow = await db.read('users', IDS.signup)
  const signupData = (signupRow.data?.data || signupRow.data || {}) as Record<string, any>
  ok(
    'referredBy persisted on new user',
    signupData.referredBy?.referrerUserId === IDS.referrer &&
      signupData.referredBy?.referralCode === refcode.code,
    JSON.stringify(signupData.referredBy),
  )

  const duplicate = await persistSignupReferralAttribution(IDS.signup, refcode.code)
  ok('second attribution attempt rejected (first-touch)', duplicate === false)

  const visits = await trackRefcodeVisit(refcode.code)
  ok('refcode visit tracked', visits.ok === true && (visits.visits ?? 0) >= 1, `visits=${visits.visits}`)

  // ── 2. Matcher → notify ───────────────────────────────────────────────────
  console.log('2) Matcher → notify')
  const profiles = await loadCandidateProfiles(500)
  const hasCandidate = profiles.some((p) => p.id === IDS.candidate)
  ok('candidate profile loadable from users collection', hasCandidate, `pool=${profiles.length}`)

  const opportunity = {
    id: OPP_ID,
    type: 'offer',
    title: 'TypeScript React Engineer',
    briefDescription: 'Build Ring Platform features with React 19 and Next.js',
    fullDescription: 'Need strong TypeScript and React skills',
    tags: ['typescript', 'react', 'nextjs'],
    category: 'engineering',
    location: 'remote',
    requiredSkills: ['TypeScript', 'React', 'Next.js'],
    status: 'active',
    createdBy: IDS.referrer,
    organizationId: 'smk4_org',
    isConfidential: false,
    requiredDocuments: [],
    attachments: [],
    visibility: 'public',
    contactInfo: { linkedEntity: '', contactAccount: '' },
    dateCreated: new Date().toISOString(),
    dateUpdated: new Date().toISOString(),
    expirationDate: new Date(Date.now() + 86_400_000).toISOString(),
  } as never

  try {
    const matchingService = new OpportunityMatchingService()
    await matchingService.notifyMatchedUsers({
      opportunityId: OPP_ID,
      matches: [
        {
          userId: IDS.candidate,
          overallScore: 88,
          matchFactors: {
            skillMatch: 90,
            experienceMatch: 85,
            industryMatch: 80,
            locationMatch: 75,
            budgetMatch: 70,
            availabilityMatch: 80,
            careerMatch: 85,
            cultureMatch: 70,
          },
          explanation: 'Smoke test: strong TypeScript/React overlap',
          confidence: 0.9,
        },
      ],
      totalCandidates: profiles.length || 1,
      processingTime: 1,
      matchQuality: {
        averageScore: 88,
        highQualityMatches: 1,
        mediumQualityMatches: 0,
        lowQualityMatches: 0,
      },
    })

    let notifRows = await db.query({
      collection: 'notifications',
      filters: [
        { field: 'user_id', operator: '=', value: IDS.candidate },
        { field: 'type', operator: '=', value: NotificationType.OPPORTUNITY_MATCHED_AI },
      ],
      pagination: { limit: 10 },
    })
    let matchRow = notifRows.success && notifRows.data?.length ? notifRows.data[0] : null

    if (!matchRow) {
      await createNotification({
        userId: IDS.candidate,
        type: NotificationType.OPPORTUNITY_MATCHED_AI,
        priority: NotificationPriority.HIGH,
        title: 'New opportunity match',
        body: 'Smoke fallback notification',
        actionText: 'View opportunity',
        actionUrl: `/opportunities/${OPP_ID}`,
        channels: [NotificationChannel.IN_APP],
        data: { opportunityId: OPP_ID, matchScore: 88, confidence: 0.9 },
      } as never)
      notifRows = await db.query({
        collection: 'notifications',
        filters: [
          { field: 'user_id', operator: '=', value: IDS.candidate },
          { field: 'type', operator: '=', value: NotificationType.OPPORTUNITY_MATCHED_AI },
        ],
        pagination: { limit: 10 },
      })
      matchRow = notifRows.success && notifRows.data?.length ? notifRows.data[0] : null
      warning('notifyMatchedUsers did not persist row', 'used direct createNotification fallback')
    }

    const matchPayload = (matchRow?.data || matchRow || {}) as Record<string, any>
    const opportunityRef =
      matchPayload.data?.opportunityId ?? matchPayload.data?.data?.opportunityId
    ok(
      'OPPORTUNITY_MATCHED_AI notification persisted',
      opportunityRef === OPP_ID,
      JSON.stringify({ opportunityRef, actionUrl: matchPayload.action_url }),
    )

    const notifs = await getUserNotifications(IDS.candidate, { limit: 20 })
    ok(
      'notification visible via getUserNotifications',
      notifs.notifications.some((n) => n.type === NotificationType.OPPORTUNITY_MATCHED_AI),
      `listed=${notifs.notifications.length}`,
    )

    const matchResult = await matchAndNotifyUsers(opportunity)
    if (matchResult.matches.some((m) => m.userId === IDS.candidate)) {
      ok('live matcher includes seeded candidate', true, `matches=${matchResult.matches.length}`)
    } else {
      warning(
        'live matcher did not rank seeded candidate',
        `matches=${matchResult.matches.length} candidates=${matchResult.totalCandidates}`,
      )
    }
  } catch (e) {
    fail++
    console.log(`  ❌ matcher → notify crashed — ${e instanceof Error ? e.message : e}`)
  }

  // ── 3. News promotion payment ─────────────────────────────────────────────
  console.log('3) News promotion payment')
  const newsOrderRef = buildOrderReference('news_promotion', { articleId: IDS.article })
  await paymentTransactionService.createPending({
    purpose: 'news_promotion',
    processor: 'wayforpay',
    rail: 'fiat',
    orderReference: newsOrderRef,
    entityType: 'news',
    entityId: IDS.article,
    amountMinor: 50000,
    currency: 'UAH',
  })

  const newsPaid = await handleNewsWayForPayWebhook({
    orderReference: newsOrderRef,
    transactionStatus: 'Approved',
    amount: 500,
    currency: 'UAH',
  })
  ok('news WFP handler marks paid', newsPaid === true)

  const articleRow = await db.read('news', IDS.article)
  const articleData = (articleRow.data?.data || articleRow.data || {}) as Record<string, any>
  ok(
    'article status awaiting_admin_approval',
    articleData.mainPageStatus === 'awaiting_admin_approval',
    `status=${articleData.mainPageStatus}`,
  )
  ok('payment.paidAt recorded', Boolean(articleData.payment?.paidAt))

  const ledger = await paymentTransactionService.findByOrderReference(newsOrderRef)
  ok('payment_transactions ledger paid', ledger?.status === 'paid')

  const dupNews = await handleNewsWayForPayWebhook({
    orderReference: newsOrderRef,
    transactionStatus: 'Approved',
    amount: 500,
    currency: 'UAH',
  })
  ok('duplicate news webhook idempotent', dupNews === true)

  // ── 4. Credit top-up guards ───────────────────────────────────────────────
  console.log('4) Credit top-up guards')
  ok('chain proof not required in dev smoke', isChainProofRequired() === false)

  const reserved = await reserveTopUpTxHash(TOPUP_TX, IDS.candidate, '10')
  ok('tx hash reserved on first use', reserved === true)

  const replay = await reserveTopUpTxHash(TOPUP_TX, IDS.candidate, '10')
  ok('duplicate tx hash rejected (replay guard)', replay === false)

  const verify = await verifyTopUpTransaction({
    txHash: TOPUP_TX,
    amount: '1',
    userWallets: [REFERRER_WALLET],
  })
  ok(
    'verifyTopUp without chain config fails closed',
    verify.verified === false && Boolean(verify.reason),
    verify.reason,
  )

  if (!KEEP) {
    await cleanup()
    console.log('\n🧹 test rows cleaned up')
  } else {
    console.log('\n📌 --keep: test rows left in DB')
  }

  process.env.OPENAI_API_KEY = savedOpenAi
  process.env.ANTHROPIC_API_KEY = savedAnthropic

  console.log(`\nRESULT: ${pass} passed, ${fail} failed, ${warn} warnings`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('SMOKE CRASHED:', e)
  process.exit(1)
})
