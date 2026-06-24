import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { queryString } from '@/lib/server/request'
import {
  ensureFutureFeaturePool,
  getPoolStatsBySlug,
  listPublicPools,
} from '@/features/public-pools/services/public-pool-service'
import { deriveFutureFeaturePoolSlug } from '@/lib/public-pools/pool-slug'
import { z } from 'zod'

const EnsureBodySchema = z.object({
  doc_path: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  implementation_cost: z.number().int().min(0),
  labels: z.array(z.string()).default([]),
  pool_slug: z.string().optional(),
})

export async function GET(request: NextRequest) {
  await connection()

  const slug = queryString(request, 'slug')
  const session = await auth()

  if (!slug) {
    const status = queryString(request, 'status') as
      | 'open'
      | 'queued'
      | 'in_progress'
      | 'completed'
      | 'cancelled'
      | undefined
    const pools = await listPublicPools(status ? { status } : undefined)
    return NextResponse.json({ pools })
  }

  const stats = await getPoolStatsBySlug(slug, session?.user?.id)

  if (!stats) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  }

  return NextResponse.json(stats)
}

/** Upsert future_feature pool from widget metadata, return stats. */
export async function POST(request: NextRequest) {
  await connection()

  try {
    const body = await request.json()
    const parsed = EnsureBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const data = parsed.data
    const pool = await ensureFutureFeaturePool(data.doc_path, {
      name: data.name,
      description: data.description,
      implementationCost: data.implementation_cost,
      labels: data.labels,
      poolSlug: data.pool_slug,
    })

    const session = await auth()
    const slug =
      data.pool_slug?.trim() ||
      deriveFutureFeaturePoolSlug(data.doc_path, data.name)
    const stats = await getPoolStatsBySlug(slug, session?.user?.id)

    return NextResponse.json({ pool, stats })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to ensure pool'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
