import 'server-only'

import { randomUUID } from 'crypto'
import { db, initializeDatabase } from '@/lib/database'
import { logger } from '@/lib/logger'
import type {
  ProjectOrder,
  ProjectOrderSnapshot,
  ProjectPaymentStatus,
  ProjectWorkStatus,
} from '@/features/crm/orders/types'
import type { CalculatorInputs } from '@/features/calculator/types'
import { calculateProject } from '@/features/calculator/engine'
import { resolveCalculatorRates } from '@/features/calculator/rates'
import {
  PROJECT_EXTERNAL_IDS,
  PROJECT_HOSTING_IDS,
  PROJECT_MODULE_IDS,
  PROJECT_NICHE_IDS,
  PROJECT_SCALE_IDS,
} from '@/features/calculator/presets/project'

const COLLECTION = 'project_orders'

function nowIso(): string {
  return new Date().toISOString()
}

function asOrder(row: Record<string, unknown> | null | undefined): ProjectOrder | null {
  if (!row) return null
  const data = (row.data ?? row) as Record<string, unknown>
  const id = String(row.id ?? data.id ?? '')
  if (!id) return null
  return {
    id,
    userId: String(data.userId ?? ''),
    paymentStatus: (data.paymentStatus as ProjectPaymentStatus) ?? 'draft',
    workStatus: (data.workStatus as ProjectWorkStatus) ?? 'new',
    progress: typeof data.progress === 'number' ? data.progress : 0,
    integratorId: data.integratorId ? String(data.integratorId) : null,
    requestorIds: Array.isArray(data.requestorIds)
      ? data.requestorIds.map(String)
      : [],
    opportunityId: data.opportunityId ? String(data.opportunityId) : null,
    details: String(data.details ?? ''),
    snapshot: data.snapshot as ProjectOrderSnapshot,
    amount: typeof data.amount === 'number' ? data.amount : 0,
    currency: String(data.currency ?? 'USD'),
    orderReference: data.orderReference ? String(data.orderReference) : null,
    paymentTransactionId: data.paymentTransactionId
      ? String(data.paymentTransactionId)
      : null,
    refundReference: data.refundReference ? String(data.refundReference) : null,
    refundedAt: data.refundedAt ? String(data.refundedAt) : null,
    createdAt: String(data.createdAt ?? row.created_at ?? nowIso()),
    updatedAt: String(data.updatedAt ?? row.updated_at ?? nowIso()),
  }
}

export function buildProjectOrderDetails(
  inputs: CalculatorInputs,
  snapshot: ProjectOrderSnapshot,
): string {
  const niche = inputs.niche && PROJECT_NICHE_IDS.includes(inputs.niche as any) ? inputs.niche : '—'
  const scale = inputs.scale && PROJECT_SCALE_IDS.includes(inputs.scale as any) ? inputs.scale : '—'
  const hosting =
    inputs.hosting && PROJECT_HOSTING_IDS.includes(inputs.hosting as any) ? inputs.hosting : '—'
  const modules = inputs.modules.filter((id) => PROJECT_MODULE_IDS.includes(id as any)).join(', ')
  const externals = inputs.externals
    .filter((id) => PROJECT_EXTERNAL_IDS.includes(id as any))
    .join(', ')

  const lines = [
    `Niche: ${niche}`,
    `Scale: ${scale}`,
    `Hosting: ${hosting}`,
    `Modules: ${modules || '—'}`,
    `Ringdom services: ${externals || '—'}`,
    `Branding: ${inputs.branding ? 'yes' : 'no'}`,
    `Need human integrator: ${inputs.needHumanDev ? 'yes' : 'no'}`,
    `One-time: ${snapshot.results.oneTimeFiat} ${snapshot.rates.defaultCurrency} (${snapshot.results.oneTimePoints} pts)`,
    `Monthly estimate: ${snapshot.results.monthlyFiat} ${snapshot.rates.defaultCurrency}`,
    `Complexity: ${snapshot.results.complexity} (${snapshot.results.customizationComplexity}%)`,
    `Estimated hours: ${snapshot.results.estimatedHours}`,
  ]
  return lines.join('\n')
}

async function ensureDb() {
  await initializeDatabase()
}

export const ProjectOrderService = {
  async createDraft(userId: string, inputs: CalculatorInputs): Promise<ProjectOrder> {
    await ensureDb()
    const rates = resolveCalculatorRates()
    const results = calculateProject(inputs, {
      rates,
      labels: {
        nicheName: String(inputs.niche || '—'),
        hostingLabel: String(inputs.hosting || '—'),
        moduleNames: Object.fromEntries(PROJECT_MODULE_IDS.map((id) => [id, id])),
        externalNames: Object.fromEntries(PROJECT_EXTERNAL_IDS.map((id) => [id, id])),
      },
      timelineTasks: {
        simple: { week1: [], week2: [], week3: [], week4: [] },
        medium: { week1: [], week2: [], week3: [], week4: [] },
        complex: { week1: [], week2: [], week3: [], week4: [] },
      },
    })

    const snapshot: ProjectOrderSnapshot = {
      inputs,
      results: {
        oneTimePoints: results.oneTimePoints,
        monthlyPoints: results.monthlyPoints,
        oneTimeFiat: results.oneTimeFiat,
        monthlyFiat: results.monthlyFiat,
        oneTimeNative: results.oneTimeNative,
        monthlyNative: results.monthlyNative,
        complexity: results.complexity,
        customizationComplexity: results.customizationComplexity,
        estimatedHours: results.estimatedHours,
        recommendedConfig: results.recommendedConfig,
      },
      rates: results.rates,
    }

    const id = `po_${Date.now()}_${randomUUID().slice(0, 8)}`
    const createdAt = nowIso()
    const doc: Omit<ProjectOrder, 'id'> & { id: string } = {
      id,
      userId,
      paymentStatus: 'draft',
      workStatus: 'new',
      progress: 0,
      integratorId: null,
      requestorIds: [],
      opportunityId: null,
      details: buildProjectOrderDetails(inputs, snapshot),
      snapshot,
      amount: results.oneTimeFiat,
      currency: rates.defaultCurrency,
      orderReference: null,
      paymentTransactionId: null,
      refundReference: null,
      refundedAt: null,
      createdAt,
      updatedAt: createdAt,
    }

    const result = await db().createDoc(COLLECTION, doc, { id })
    if (!result.success || !result.data) {
      throw result.error || new Error('Failed to create project order')
    }
    const order = asOrder(result.data as Record<string, unknown>)
    if (!order) throw new Error('Failed to map project order')
    return order
  },

  async getById(id: string): Promise<ProjectOrder | null> {
    await ensureDb()
    const result = await db().findDocById(COLLECTION, id)
    if (!result.success || !result.data) return null
    return asOrder(result.data as Record<string, unknown>)
  },

  async listAdmin(opts?: {
    workStatus?: ProjectWorkStatus
    limit?: number
  }): Promise<ProjectOrder[]> {
    await ensureDb()
    const filters = opts?.workStatus
      ? [{ field: 'workStatus', operator: '=' as const, value: opts.workStatus }]
      : undefined
    const result = await db().queryDocs({
      collection: COLLECTION,
      filters,
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: opts?.limit ?? 100 },
    })
    if (!result.success || !result.data) return []
    return (result.data as Record<string, unknown>[])
      .map((row) => asOrder(row))
      .filter((o): o is ProjectOrder => Boolean(o))
  },

  async listForIntegrator(integratorId: string): Promise<ProjectOrder[]> {
    await ensureDb()
    const result = await db().queryDocs({
      collection: COLLECTION,
      filters: [{ field: 'integratorId', operator: '=', value: integratorId }],
      orderBy: [{ field: 'updatedAt', direction: 'desc' }],
      pagination: { limit: 100 },
    })
    if (!result.success || !result.data) return []
    return (result.data as Record<string, unknown>[])
      .map((row) => asOrder(row))
      .filter((o): o is ProjectOrder => Boolean(o))
  },

  async listForUser(userId: string): Promise<ProjectOrder[]> {
    await ensureDb()
    const result = await db().queryDocs({
      collection: COLLECTION,
      filters: [{ field: 'userId', operator: '=', value: userId }],
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: 50 },
    })
    if (!result.success || !result.data) return []
    return (result.data as Record<string, unknown>[])
      .map((row) => asOrder(row))
      .filter((o): o is ProjectOrder => Boolean(o))
  },

  async patch(
    id: string,
    patch: Partial<
      Pick<
        ProjectOrder,
        | 'paymentStatus'
        | 'workStatus'
        | 'progress'
        | 'integratorId'
        | 'requestorIds'
        | 'opportunityId'
        | 'orderReference'
        | 'paymentTransactionId'
        | 'refundReference'
        | 'refundedAt'
        | 'details'
      >
    >,
  ): Promise<ProjectOrder> {
    await ensureDb()
    const existing = await this.getById(id)
    if (!existing) throw new Error('Project order not found')

    const next = {
      ...existing,
      ...patch,
      progress:
        typeof patch.progress === 'number'
          ? Math.max(0, Math.min(100, Math.round(patch.progress)))
          : existing.progress,
      updatedAt: nowIso(),
    }

    const { id: _id, ...data } = next
    const result = await db().updateDoc(COLLECTION, id, data)
    if (!result.success) {
      throw result.error || new Error('Failed to update project order')
    }
    return next
  },

  async markPendingPayment(id: string, orderReference: string): Promise<ProjectOrder> {
    return this.patch(id, {
      paymentStatus: 'pending_payment',
      orderReference,
    })
  },

  async markPaid(id: string, orderReference: string): Promise<ProjectOrder> {
    const existing = await this.getById(id)
    if (!existing) throw new Error('Project order not found')
    if (existing.paymentStatus === 'paid') return existing
    return this.patch(id, {
      paymentStatus: 'paid',
      workStatus: existing.workStatus === 'canceled' ? existing.workStatus : 'new',
      orderReference,
      paymentTransactionId: orderReference,
    })
  },

  async appendRequestor(id: string, userId: string): Promise<ProjectOrder> {
    const existing = await this.getById(id)
    if (!existing) throw new Error('Project order not found')
    if (existing.workStatus !== 'available') {
      throw new Error('Order is not available for requests')
    }
    if (existing.requestorIds.includes(userId)) return existing
    return this.patch(id, {
      requestorIds: [...existing.requestorIds, userId],
    })
  },

  async assignIntegrator(id: string, integratorId: string): Promise<ProjectOrder> {
    const existing = await this.getById(id)
    if (!existing) throw new Error('Project order not found')
    const next = await this.patch(id, {
      integratorId,
      workStatus: 'in_progress',
    })
    await closeProjectOrderOpportunity(existing.opportunityId)
    // Repair/create order_lab so assignee can open Reggie tab (admin may have bootstrapped earlier)
    const { ensureOrderLabForAssignee } = await import(
      '@/features/crm/lab/order-lab-chat-service'
    )
    await ensureOrderLabForAssignee(id, integratorId, existing.userId)
    return next
  },

  async setWorkStatus(id: string, workStatus: ProjectWorkStatus): Promise<ProjectOrder> {
    return this.patch(id, { workStatus })
  },

  async markRefunded(id: string, refundReference: string): Promise<ProjectOrder> {
    return this.patch(id, {
      paymentStatus: 'refunded',
      workStatus: 'canceled',
      refundReference,
      refundedAt: nowIso(),
    })
  },
}

export async function publishProjectOrderOpportunity(
  order: ProjectOrder,
  actorUserId: string,
): Promise<string> {
  const { createOpportunity } = await import(
    '@/features/opportunities/services/create-opportunity'
  )
  const { updateOpportunity } = await import(
    '@/features/opportunities/services/update-opportunity'
  )

  const title = `Ring customization: ${order.snapshot.inputs.niche || 'project'}`
  const briefDescription =
    order.details.split('\n').slice(0, 4).join(' · ') || 'Custom Ring platform build'
  const payload = {
    type: 'ring_customization' as const,
    title,
    briefDescription,
    fullDescription: order.details,
    visibility: 'member' as const,
    category: 'services',
    location: 'Remote',
    status: 'active',
    isActive: true,
    applicants: order.requestorIds,
    applicantCount: order.requestorIds.length,
    budget: {
      min: order.amount,
      max: order.amount,
      currency: order.currency,
    },
    contactInfo: {
      contactAccount: order.userId,
    },
    projectOrderId: order.id,
    tags: ['ringization', 'calculator', 'custom'],
  }

  if (order.opportunityId) {
    await updateOpportunity(order.opportunityId, payload as any)
    return order.opportunityId
  }

  // createOpportunity uses session auth — caller must be admin/member
  const created = await createOpportunity({
    ...payload,
    createdBy: actorUserId,
  } as any)
  return created.id
}

export async function closeProjectOrderOpportunity(opportunityId: string | null) {
  if (!opportunityId) return
  try {
    const { updateOpportunity } = await import(
      '@/features/opportunities/services/update-opportunity'
    )
    await updateOpportunity(opportunityId, {
      isActive: false,
      status: 'closed',
    } as any)
  } catch (error) {
    logger.warn('Failed to close project order opportunity', { opportunityId, error })
  }
}
