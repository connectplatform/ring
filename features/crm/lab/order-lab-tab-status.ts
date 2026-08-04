import type { ProjectOrder } from '@/features/crm/orders/types'
import type { OrderProjectConfig } from '@/features/crm/orders/order-project-config'
import { BUYER_PROJECT_CONFIG_MASK } from '@/features/crm/orders/order-project-config'
import { ENV_ESSENTIALS } from '@/features/crm/lab/env-essentials'
import { getEnvKeyOwner } from '@/features/crm/lab/env-key-ownership'
import {
  emptyTabStatus,
  type OrderLabTabId,
  type OrderLabTabStatus,
  type OrderLabTabStatusKind,
} from '@/features/crm/lab/order-lab-tabs'

export type EnvValueLike = { value?: string | null } | string | null | undefined

export type OrderLabTabStatusInput = {
  order: ProjectOrder
  projectConfig?: OrderProjectConfig | null
  /** Flat env map: key → value or { value } */
  envConfig?: Record<string, EnvValueLike> | null
  deployment?: {
    lastDeployStatus?: string | null
    lastError?: string | null
    namespace?: string | null
    projectUrl?: string | null
  } | null
  podsSummary?: {
    total: number
    ready: number
    restarts: number
  } | null
  /** Unknown / rejected env keys */
  invalidEnvKeys?: string[] | null
  /** Panel crash ids reported via LabPanelBoundary.onError */
  crashedTabs?: OrderLabTabId[] | null
}

function envValue(raw: EnvValueLike): string {
  if (raw == null) return ''
  if (typeof raw === 'string') return raw.trim()
  return String(raw.value ?? '').trim()
}

function finalize(
  missingRequired: string[],
  missingRecommended: string[],
  errors: string[],
): OrderLabTabStatus {
  let status: OrderLabTabStatusKind = 'ok'
  if (errors.length > 0 || missingRequired.length > 0) status = 'error'
  else if (missingRecommended.length > 0) status = 'incomplete'
  return {
    status,
    missingRequired,
    missingRecommended,
    errors,
    recommendedPending: missingRecommended.length || undefined,
  }
}

function projectVitalGaps(cfg: OrderProjectConfig | null | undefined): {
  required: string[]
  recommended: string[]
} {
  const required: string[] = []
  const recommended: string[] = []
  const clone = cfg?.clone
  for (const key of BUYER_PROJECT_CONFIG_MASK.clone) {
    const v = clone?.[key]
    if (!v || !String(v).trim()) required.push(`clone.${key}`)
  }
  const branding = cfg?.branding
  for (const key of BUYER_PROJECT_CONFIG_MASK.branding) {
    if (key === 'colors') {
      const c = branding?.colors
      if (!c?.primary && !c?.accent) recommended.push('branding.colors')
      continue
    }
    const v = branding?.[key as keyof NonNullable<typeof branding>]
    if (!v || !String(v).trim()) {
      if (key === 'logoUrl' || key === 'slogan') recommended.push(`branding.${key}`)
      else recommended.push(`branding.${key}`)
    }
  }
  // Tier-2 presets — recommended Layer2-SSOT
  if (!cfg?.home?.preset) recommended.push('home.preset')
  if (!cfg?.entities?.preset) recommended.push('entities.preset')
  if (!cfg?.productFields?.preset) recommended.push('productFields.preset')
  if (!cfg?.domainFeatureId) recommended.push('domainFeatureId')
  return { required, recommended }
}

function envGaps(envConfig: Record<string, EnvValueLike> | null | undefined): {
  required: string[]
  recommended: string[]
} {
  const required: string[] = []
  for (const key of ENV_ESSENTIALS) {
    if (!envValue(envConfig?.[key])) required.push(key)
  }
  return { required, recommended: [] }
}

/**
 * Compute per-tab completion chips for Order Lab rails.
 * Safe to call from RSC (no browser APIs).
 */
export function computeOrderLabTabStatuses(
  input: OrderLabTabStatusInput,
): Partial<Record<OrderLabTabId, OrderLabTabStatus>> {
  const cfg = input.projectConfig ?? input.order.projectConfig ?? null
  const vital = projectVitalGaps(cfg)
  const env = envGaps(input.envConfig)
  const invalid = (input.invalidEnvKeys || []).filter(Boolean)
  const crashed = new Set(input.crashedTabs || [])

  const withCrash = (id: OrderLabTabId, base: OrderLabTabStatus): OrderLabTabStatus => {
    if (!crashed.has(id)) return base
    return {
      ...base,
      status: 'error',
      errors: [...base.errors, 'panel_render_failed'],
    }
  }

  const overviewErrors: string[] = []
  if (input.order.workStatus === 'disputed') overviewErrors.push('work_disputed')
  if (input.order.paymentStatus === 'failed') overviewErrors.push('payment_failed')

  const deployErrors: string[] = []
  if (input.deployment?.lastDeployStatus === 'failed' || input.deployment?.lastError) {
    deployErrors.push(input.deployment.lastError || 'deploy_failed')
  }
  const deployRequired: string[] = []
  if (!input.deployment?.namespace) deployRequired.push('namespace')
  const deployRecommended: string[] = []
  if (!input.deployment?.projectUrl) deployRecommended.push('projectUrl')
  if (
    input.podsSummary &&
    input.podsSummary.total > 0 &&
    input.podsSummary.ready < input.podsSummary.total
  ) {
    deployRecommended.push('pods_not_ready')
  }

  const manageIncomplete: string[] = []
  if (!input.order.integratorId && input.order.paymentStatus === 'paid') {
    manageIncomplete.push('integrator')
  }

  const out: Partial<Record<OrderLabTabId, OrderLabTabStatus>> = {
    overview: withCrash(
      'overview',
      finalize([], [], overviewErrors),
    ),
    manage: withCrash(
      'manage',
      finalize([], manageIncomplete, []),
    ),
    project: withCrash(
      'project',
      finalize(vital.required, vital.recommended, []),
    ),
    secrets: withCrash(
      'secrets',
      // Secrets tab = owner_private (+ public_shared essentials shown there), NOT integrator_ops
      finalize(
        ENV_ESSENTIALS.filter((k) => {
          const owner = getEnvKeyOwner(k)
          if (owner !== 'owner_private' && owner !== 'public_shared') return false
          return !envValue(input.envConfig?.[k])
        }),
        [],
        [],
      ),
    ),
    env: withCrash(
      'env',
      finalize(env.required, env.recommended, invalid.map((k) => `invalid:${k}`)),
    ),
    source: withCrash('source', emptyTabStatus('ok')),
    deploy: withCrash(
      'deploy',
      finalize(deployRequired, deployRecommended, deployErrors),
    ),
    chats: withCrash('chats', emptyTabStatus('ok')),
    wiki: withCrash('wiki', emptyTabStatus('ok')),
  }

  return out
}
