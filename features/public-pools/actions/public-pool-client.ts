'use client'

import type { PublicPoolStatsResponse } from '@/lib/zod/public-pool-schemas'

function encodedSlug(slug: string): string {
  return encodeURIComponent(slug)
}

export async function ensureFutureFeaturePoolClient(params: {
  docPath: string
  name: string
  description: string
  implementationCost: number
  labels: string[]
  poolSlug?: string
}): Promise<{ stats: PublicPoolStatsResponse | null; poolSlug: string }> {
  const res = await fetch('/api/public-pools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      doc_path: params.docPath,
      name: params.name,
      description: params.description,
      implementation_cost: params.implementationCost,
      labels: params.labels,
      pool_slug: params.poolSlug,
    }),
  })

  if (!res.ok) {
    throw new Error('Failed to load pool')
  }

  const json = await res.json()
  const poolSlug =
    params.poolSlug ??
    json.pool?.pool_slug ??
    json.stats?.pool?.pool_slug

  return { stats: json.stats ?? null, poolSlug }
}

export async function fetchPoolStats(slug: string): Promise<PublicPoolStatsResponse | null> {
  const res = await fetch(`/api/public-pools?slug=${encodedSlug(slug)}`, {
    credentials: 'include',
  })
  if (res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw new Error('Failed to fetch pool stats')
  }
  return res.json()
}

export async function togglePoolLikeClient(slug: string): Promise<PublicPoolStatsResponse> {
  const res = await fetch(`/api/public-pools/signal?slug=${encodedSlug(slug)}`, {
    method: 'POST',
    credentials: 'include',
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error ?? 'Failed to toggle like')
  }
  return json
}

export async function contributeToPoolClient(
  slug: string,
  amountRing: string,
  idempotencyKey: string,
  fundingMode: 'donation' | 'escrow' = 'donation',
): Promise<PublicPoolStatsResponse & { tx_hash: string }> {
  const res = await fetch(`/api/public-pools/contribute?slug=${encodedSlug(slug)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      amount_ring: amountRing,
      idempotency_key: idempotencyKey,
      funding_mode: fundingMode,
    }),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error ?? 'Contribution failed')
  }
  return json
}

export type LikeActionState = {
  error: string | null
  stats: PublicPoolStatsResponse | null
}

export async function likeActionReducer(
  _prev: LikeActionState,
  slug: string,
): Promise<LikeActionState> {
  try {
    const stats = await togglePoolLikeClient(slug)
    return { error: null, stats }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Like failed',
      stats: _prev.stats,
    }
  }
}
