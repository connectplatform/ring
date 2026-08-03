import 'server-only'

import { ConversationService } from '@/features/chat/services/conversation-service'
import { MessageService } from '@/features/chat/services/message-service'
import type { Conversation } from '@/features/chat/types'
import {
  RING_REGGIE_AGENT_ID,
  RING_REGGIE_AGENT_NAME,
} from '@/features/crm/lab/reggie-constants'
import { logger } from '@/lib/logger'

const conversationService = new ConversationService()
const messageService = new MessageService()

type EnsureParticipantsOpts = {
  integratorId?: string | null
  buyerId?: string | null
  adminId?: string | null
}

/**
 * Ensure shared project room participants: buyer + integrator + Reggie (+ optional admin).
 */
async function ensureOrderLabParticipants(
  conversation: Conversation,
  opts: EnsureParticipantsOpts,
): Promise<Conversation> {
  const ids = new Set(conversation.participants.map((p) => p.userId))
  const toAdd: Array<{ userId: string; role: 'admin' | 'member' }> = []

  if (opts.integratorId && !ids.has(opts.integratorId)) {
    toAdd.push({ userId: opts.integratorId, role: 'admin' })
  }
  if (opts.buyerId && !ids.has(opts.buyerId)) {
    toAdd.push({ userId: opts.buyerId, role: 'member' })
  }
  if (opts.adminId && !ids.has(opts.adminId)) {
    toAdd.push({ userId: opts.adminId, role: 'admin' })
  }
  if (!ids.has(RING_REGGIE_AGENT_ID)) {
    toAdd.push({ userId: RING_REGGIE_AGENT_ID, role: 'member' })
  }

  for (const { userId, role } of toAdd) {
    try {
      await conversationService.addParticipant(conversation.id, userId, role)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (!/already a participant/i.test(msg)) {
        logger.warn('Order lab participant repair failed', {
          conversationId: conversation.id,
          userId,
          error: msg,
        })
      }
    }
  }

  if (toAdd.length === 0) return conversation
  const refreshed = await conversationService.findOrderLabConversation(
    String(conversation.metadata?.orderId || ''),
  )
  return refreshed || conversation
}

/**
 * Copy deployment + order identity onto order_lab metadata for Reggie lock + role hints.
 */
export async function syncOrderLabMetadata(orderId: string): Promise<void> {
  try {
    const conversation = await conversationService.findOrderLabConversation(orderId)
    if (!conversation) return

    const { ProjectDeploymentService } = await import(
      '@/features/crm/lab/deployment-service'
    )
    const { ProjectOrderService } = await import(
      '@/features/crm/orders/project-order-service'
    )
    const dep = await ProjectDeploymentService.getByOrderId(orderId)
    const order = await ProjectOrderService.getById(orderId)
    const actor =
      conversation.participants.find((p) => p.userId !== RING_REGGIE_AGENT_ID)?.userId ||
      RING_REGGIE_AGENT_ID

    await conversationService.updateConversation(conversation.id, actor, {
      metadata: {
        ...conversation.metadata,
        orderId,
        kind: 'order_lab',
        hiddenFromInbox: true,
        subject: conversation.metadata?.subject || `Project room ${orderId}`,
        ...(order?.userId ? { buyerUserId: order.userId } : {}),
        ...(order?.integratorId ? { integratorId: order.integratorId } : {}),
        ...(dep?.namespace ? { namespace: dep.namespace } : {}),
        ...(dep?.deploymentName ? { deploymentName: dep.deploymentName } : {}),
        ...(dep?.edge ? { edge: dep.edge } : {}),
        ...(dep?.projectName ? { projectName: dep.projectName } : {}),
      },
    })
  } catch (error) {
    logger.warn('syncOrderLabMetadata failed', { orderId, error })
  }
}

/**
 * Get or create the shared order_lab project room (buyer + integrator + Reggie).
 */
export async function getOrCreateOrderLabConversation(
  orderId: string,
  opts: {
    integratorId?: string | null
    buyerId?: string | null
    adminId?: string | null
  },
): Promise<Conversation> {
  const creatorId =
    opts.integratorId || opts.buyerId || opts.adminId || RING_REGGIE_AGENT_ID
  const existing = await conversationService.findOrderLabConversation(orderId)
  if (existing) {
    const repaired = await ensureOrderLabParticipants(existing, opts)
    await syncOrderLabMetadata(orderId)
    return (await conversationService.findOrderLabConversation(orderId)) || repaired
  }

  const participantIds = [
    ...new Set(
      [
        opts.integratorId,
        opts.buyerId,
        opts.adminId,
        RING_REGGIE_AGENT_ID,
      ].filter(Boolean) as string[],
    ),
  ]

  const conversation = await conversationService.createConversation({
    type: 'order_lab',
    participantIds,
    creatorUserId: creatorId,
    metadata: {
      orderId,
      kind: 'order_lab',
      hiddenFromInbox: true,
      subject: `Project room ${orderId}`,
    },
  })

  try {
    await messageService.sendMessage(
      {
        conversationId: conversation.id,
        content:
          'Reggie online in the shared project room. Buyer, integrator, and Reggie share this thread. I am locked to this order’s namespace and project — ask about this clone only.',
        type: 'system',
      },
      RING_REGGIE_AGENT_ID,
      RING_REGGIE_AGENT_NAME,
    )
  } catch (error) {
    logger.warn('Order lab welcome message failed', { orderId, error })
  }

  await syncOrderLabMetadata(orderId)
  return (await conversationService.findOrderLabConversation(orderId)) || conversation
}

/** Call after assign so the integrator can open the project room. */
export async function ensureOrderLabForAssignee(
  orderId: string,
  integratorId: string,
  buyerId?: string | null,
): Promise<void> {
  try {
    await getOrCreateOrderLabConversation(orderId, {
      integratorId,
      buyerId: buyerId ?? undefined,
    })
  } catch (error) {
    logger.warn('ensureOrderLabForAssignee failed', { orderId, integratorId, error })
  }
}

/** Seed ringization playbook markdown into the order_lab thread (best-effort). */
export async function seedRingizationPlaybookMessage(orderId: string): Promise<void> {
  try {
    const { formatPlaybookMarkdown, PLAYBOOK_SEED_MARKER } = await import(
      '@/features/crm/lab/ringization-playbook'
    )
    const conversation = await conversationService.findOrderLabConversation(orderId)
    if (!conversation) return

    // Idempotent: skip if a prior assign already seeded the playbook
    try {
      const prior = await messageService.getMessages(
        conversation.id,
        RING_REGGIE_AGENT_ID,
        { limit: 40 },
      )
      if (prior.some((m) => typeof m.content === 'string' && m.content.includes(PLAYBOOK_SEED_MARKER))) {
        return
      }
    } catch {
      // Access check can fail for edge agents — still attempt a single seed
    }

    await messageService.sendMessage(
      {
        conversationId: conversation.id,
        content: `${PLAYBOOK_SEED_MARKER}\n${formatPlaybookMarkdown('integrator')}`,
        type: 'system',
      },
      RING_REGGIE_AGENT_ID,
      RING_REGGIE_AGENT_NAME,
    )
  } catch (error) {
    logger.warn('seedRingizationPlaybookMessage failed', { orderId, error })
  }
}

/**
 * Ensure a direct DM exists between two users (admin↔buyer or admin↔integrator).
 */
export async function getOrCreateCustomerConversation(
  currentUserId: string,
  otherUserId: string,
  otherName?: string,
): Promise<Conversation> {
  const existing = await conversationService.findDirectConversation(currentUserId, otherUserId)
  if (existing) return existing

  return conversationService.createConversation({
    type: 'direct',
    participantIds: [currentUserId, otherUserId],
    creatorUserId: currentUserId,
    metadata: {
      directUserId: otherUserId,
      ...(otherName ? { directUserName: otherName } : {}),
    },
  })
}

/**
 * Post a share_card for an Order Source Editor commit into the order_lab room.
 * Best-effort — never throws to the commit path.
 */
export async function postSourceCommitCard(opts: {
  orderId: string
  sha: string
  path: string
  message: string
  actorUserId: string
  actorName?: string | null
  buyerId?: string | null
  integratorId?: string | null
}): Promise<void> {
  try {
    const conversation = await getOrCreateOrderLabConversation(opts.orderId, {
      buyerId: opts.buyerId,
      integratorId: opts.integratorId,
      adminId: opts.actorUserId,
    })
    const sha7 = opts.sha.slice(0, 7)
    const title = (opts.message || 'Source commit').trim().slice(0, 200)
    const url = `/my-jobs/${encodeURIComponent(opts.orderId)}?source=${encodeURIComponent(opts.path)}&sha=${encodeURIComponent(opts.sha)}`
    const meta = {
      kind: 'share_card' as const,
      targetType: 'source_commit' as const,
      targetId: opts.sha,
      title,
      description: `${opts.path} @ ${sha7}`,
      url,
      commit: {
        sha: opts.sha,
        path: opts.path,
        orderId: opts.orderId,
      },
    }
    await messageService.sendMessage(
      {
        conversationId: conversation.id,
        content: `${title}\n${opts.path} @ ${sha7}`,
        type: 'share_card',
        metadata: meta as unknown as Record<string, unknown>,
      },
      opts.actorUserId,
      opts.actorName?.trim() || 'Order Lab',
    )
  } catch (error) {
    logger.warn('postSourceCommitCard failed', {
      orderId: opts.orderId,
      path: opts.path,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
