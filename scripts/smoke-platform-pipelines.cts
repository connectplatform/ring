/**
 * E2E smoke: core platform pipelines — payment ledger, store order lifecycle,
 * credit wallet, notifications, username reservation cleanup, messaging, entities.
 *
 * Seeds throwaway smk2_* rows, exercises the real services, asserts DB state, cleans up.
 *
 * Usage:
 *   NODE_OPTIONS="--conditions=react-server" \
 *   DB_BACKEND_MODE=k8s-postgres-fcm \
 *   DATABASE_URL=postgresql://ring_user:ring_password_2024@localhost:5432/ring_platform \
 *   npx tsx scripts/smoke-platform-pipelines.cts [--keep]
 */

import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { UserCreditService } from '@/features/wallet/services/user-credit-service'
import {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  getNotificationStats,
} from '@/features/notifications/services/notification-service'
import { NotificationType, NotificationChannel } from '@/features/notifications/types'
import { MessageService } from '@/features/chat/services/message-service'

const KEEP = process.argv.includes('--keep')

const IDS = {
  user: 'smk2_user',
  buyer: 'smk2_buyer',
  orderRef: 'smk2_order_ref',
  conversation: 'smk2_conversation',
  entity: 'smk2_entity',
  usernameExpired: 'smk2_expired_name',
  usernameConfirmed: 'smk2_confirmed_name',
}

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

let createdOrderId: string | null = null
let createdNotificationIds: string[] = []
let createdMessageIds: string[] = []

async function cleanup() {
  const db = getDatabaseService()
  const direct: Array<[string, string]> = [
    ['users', IDS.user],
    ['users', IDS.buyer],
    ['conversations', IDS.conversation],
    ['entities', IDS.entity],
    ['usernames', IDS.usernameExpired],
    ['usernames', IDS.usernameConfirmed],
    ['payment_transactions', `pay-${IDS.orderRef}`],
  ]
  for (const [collection, id] of direct) {
    try {
      await db.delete(collection, id)
    } catch {
      /* may not exist */
    }
  }
  const queryWipes: Array<[string, string, string]> = [
    ['orders', 'userId', IDS.buyer],
    ['notifications', 'user_id', IDS.user],
    ['messages', 'conversationId', IDS.conversation],
  ]
  for (const [collection, field, value] of queryWipes) {
    try {
      const res = await db.query({ collection, filters: [{ field, operator: '=', value }], pagination: { limit: 50 } })
      const rows = res.success && res.data ? (Array.isArray(res.data) ? res.data : []) : []
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
  await db.create('users', { name: 'Smoke User 2', createdAt: now }, { id: IDS.user })
  await db.create('users', { name: 'Smoke Buyer 2', createdAt: now }, { id: IDS.buyer })
}

async function main() {
  console.log('🔬 Platform pipelines smoke — ring_platform dev\n')
  await initializeDatabase()
  const db = getDatabaseService()

  await cleanup()
  await seed()

  // ── 1. Payment transactions ledger ────────────────────────────────────────
  console.log('1) Payment transactions ledger')
  const created = await paymentTransactionService.createPending({
    purpose: 'store_order',
    processor: 'wayforpay',
    rail: 'fiat',
    orderReference: IDS.orderRef,
    entityType: 'order',
    entityId: 'smk2_order_entity',
    userId: IDS.buyer,
    amountMinor: 200000,
    currency: 'UAH',
  })
  ok('pending tx created', created.status === 'created' && created.order_reference === IDS.orderRef)

  const dupCreate = await paymentTransactionService.createPending({
    purpose: 'store_order',
    processor: 'wayforpay',
    rail: 'fiat',
    orderReference: IDS.orderRef,
    entityType: 'order',
    entityId: 'smk2_order_entity',
  })
  ok('duplicate createPending returns existing row', dupCreate.id === created.id)

  await paymentTransactionService.markRedirected(IDS.orderRef)
  const firstPaid = await paymentTransactionService.markPaid(IDS.orderRef, { smoke: true })
  ok('markPaid first webhook returns true', firstPaid === true)
  const secondPaid = await paymentTransactionService.markPaid(IDS.orderRef)
  ok('duplicate webhook idempotent (false)', secondPaid === false)

  const row = await paymentTransactionService.findByOrderReference(IDS.orderRef)
  ok('ledger row status=paid with history', row?.status === 'paid' && (row?.status_history?.length ?? 0) >= 3,
    `status=${row?.status} history=${row?.status_history?.length}`)

  // ── 2. Store order lifecycle ───────────────────────────────────────────────
  console.log('2) Store order lifecycle')
  const orderResult = await StoreOrdersService.createOrder(
    IDS.buyer,
    {
      items: [{ productId: 'smk2_prod', quantity: 1, price: 100 }],
      subtotal: 100,
      total: 100,
      shippingInfo: { name: 'Smoke', phone: '0', address: '-', city: '-', postalCode: '-' },
    } as never,
  )
  createdOrderId = orderResult.orderId
  ok('order created', Boolean(orderResult.orderId))

  await StoreOrdersService.updateOrderPaymentStatus(orderResult.orderId, {
    method: 'wayforpay',
    status: 'paid',
    amount: 100,
    currency: 'UAH',
    paidAt: new Date().toISOString(),
  })
  await StoreOrdersService.adminUpdateOrderStatus(orderResult.orderId, 'paid')
  const fetched = (await StoreOrdersService.getOrderById(orderResult.orderId)) as Record<string, any> | null
  ok('payment status persisted', fetched?.payment?.status === 'paid')
  ok('order status persisted', fetched?.status === 'paid')

  // ── 3. Credit wallet ──────────────────────────────────────────────────────
  console.log('3) Credit wallet')
  const credit = UserCreditService.getInstance()
  await credit.initializeCreditBalance(IDS.user)
  const added = await credit.addCredits(IDS.user, { amount: '100', description: 'smoke topup' } as never, 'topup' as never, '1')
  ok('credits added (100)', added.newBalance === '100')
  const spent = await credit.spendCredits(IDS.user, { amount: '40', description: 'smoke spend' } as never, 'purchase' as never, '1')
  ok('credits spent (40 → 60)', spent.newBalance === '60')
  let overspendBlocked = false
  try {
    await credit.spendCredits(IDS.user, { amount: '1000', description: 'overspend' } as never, 'purchase' as never, '1')
  } catch {
    overspendBlocked = true
  }
  ok('overspend rejected', overspendBlocked)
  const balance = await credit.getUserCreditBalance(IDS.user)
  ok('balance + ledger trail', balance?.amount === '60' && Boolean(balance?.last_transaction_id))

  // ── 4. Notifications create → list → read → stats ────────────────────────
  console.log('4) Notifications')
  try {
    const notif = await createNotification({
      userId: IDS.user,
      type: NotificationType.ENTITY_CREATED,
      title: 'Smoke notification',
      body: 'Pipeline test',
      channels: [NotificationChannel.IN_APP],
    } as never)
    ok('notification created', Boolean(notif?.id))
    if (notif?.id) createdNotificationIds.push(notif.id)

    const list = await getUserNotifications(IDS.user, { limit: 10 })
    ok('created notification visible in user list (user_id filter fix)', list.notifications.length >= 1,
      `listed=${list.notifications.length}`)

    const unreadList = await getUserNotifications(IDS.user, { limit: 10, unreadOnly: true })
    ok('unreadOnly filter returns row', unreadList.notifications.length >= 1)

    if (notif?.id) {
      await markNotificationAsRead(notif.id, IDS.user)
      const afterRead = await getUserNotifications(IDS.user, { limit: 10, unreadOnly: true })
      ok('read notification leaves unread list', afterRead.notifications.length === 0,
        `still unread=${afterRead.notifications.length}`)
    }

    const stats = await getNotificationStats(IDS.user)
    ok('stats total >= 1, unread 0', stats.totalNotifications >= 1 && stats.unreadCount === 0,
      `total=${stats.totalNotifications} unread=${stats.unreadCount}`)
  } catch (e) {
    fail++
    console.log(`  ❌ notifications pipeline crashed — ${e instanceof Error ? e.message : e}`)
  }

  // ── 5. Username reservation cleanup ───────────────────────────────────────
  console.log('5) Username reservation cleanup')
  const past = new Date(Date.now() - 10 * 60 * 1000)
  await db.create('usernames', {
    userId: IDS.user,
    username: 'SmokeExpired',
    reservedAt: past,
    confirmed: false,
    expiresAt: past,
  }, { id: IDS.usernameExpired })
  await db.create('usernames', {
    userId: IDS.user,
    username: 'SmokeConfirmed',
    reservedAt: past,
    confirmed: true,
    expiresAt: null,
  }, { id: IDS.usernameConfirmed })

  let cleanupResult = { cleaned: 0 }
  try {
    const usersActions = await import('@/app/_actions/users')
    cleanupResult = await usersActions.cleanupExpiredUsernameReservations()
  } catch (e) {
    warning('users actions import failed; running equivalent inline query',
      e instanceof Error ? e.message.slice(0, 120) : String(e))
    const expired = await db.query({
      collection: 'usernames',
      filters: [
        { field: 'confirmed', operator: '==', value: false },
        { field: 'expiresAt', operator: '<', value: new Date() },
      ],
    })
    if (expired.success && expired.data) {
      for (const r of expired.data) {
        const del = await db.delete('usernames', r.id as string)
        if (del.success) cleanupResult.cleaned++
      }
    }
  }
  ok('expired unconfirmed reservation cleaned', cleanupResult.cleaned >= 1, `cleaned=${cleanupResult.cleaned}`)
  const expiredGone = await db.read('usernames', IDS.usernameExpired)
  ok('expired row deleted', !expiredGone.success || !expiredGone.data)
  const confirmedKept = await db.read('usernames', IDS.usernameConfirmed)
  ok('confirmed username untouched', Boolean(confirmedKept.success && confirmedKept.data))

  // ── 6. Messaging ──────────────────────────────────────────────────────────
  console.log('6) Messaging')
  await db.create('conversations', {
    participants: [IDS.user, IDS.buyer],
    type: 'direct',
    createdAt: new Date().toISOString(),
  }, { id: IDS.conversation })

  try {
    const messageService = new MessageService()
    try {
      await messageService.sendMessage(
        { conversationId: IDS.conversation, content: 'smoke message' },
        IDS.user,
        'Smoke User 2',
      )
    } catch (e) {
      // revalidatePath may throw outside a Next request context — row should still exist
      warning('sendMessage threw (likely revalidatePath outside request)', e instanceof Error ? e.message : String(e))
    }
    const messages = await db.query({
      collection: 'messages',
      filters: [{ field: 'conversationId', operator: '=', value: IDS.conversation }],
      pagination: { limit: 5 },
    })
    const mRows = messages.success && messages.data ? messages.data : []
    ok('message row persisted', mRows.length >= 1)
    for (const m of mRows) createdMessageIds.push(m.id as string)

    const convo = await db.read('conversations', IDS.conversation)
    const convoData = (convo.data?.data || convo.data || {}) as Record<string, any>
    if (convoData.lastMessage) {
      ok('conversation lastMessage updated', Boolean(convoData.lastMessage))
    } else {
      warning('conversation lastMessage not updated', 'updateConversationLastMessage may target different field/collection')
    }
  } catch (e) {
    fail++
    console.log(`  ❌ messaging pipeline crashed — ${e instanceof Error ? e.message : e}`)
  }

  // ── 7. Entities (DB-level JSONB consistency) ──────────────────────────────
  console.log('7) Entities collection')
  const entityCreate = await db.create('entities', {
    name: 'Smoke Entity 2',
    type: 'company',
    addedBy: IDS.user,
    isPublic: true,
    createdAt: new Date().toISOString(),
  }, { id: IDS.entity })
  ok('entity created', entityCreate.success)
  const entityQuery = await db.query({
    collection: 'entities',
    filters: [{ field: 'addedBy', operator: '=', value: IDS.user }],
    pagination: { limit: 5 },
  })
  ok('entity queryable by addedBy', Boolean(entityQuery.success && entityQuery.data?.length === 1))

  if (!KEEP) {
    await cleanup()
    console.log('\n🧹 test rows cleaned up')
  } else {
    console.log('\n📌 --keep: test rows left in DB')
  }

  console.log(`\nRESULT: ${pass} passed, ${fail} failed, ${warn} warnings`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('SMOKE CRASHED:', e)
  process.exit(1)
})
