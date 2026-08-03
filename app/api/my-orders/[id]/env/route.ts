import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import { ProjectDeploymentService } from '@/features/crm/lab/deployment-service'
import { assertEnvPatchAllowed, getEnvKeyOwner } from '@/features/crm/lab/env-key-ownership'
import { getEnvTemplateManifest } from '@/features/crm/lab/env-template-parser'
import { fulfillEnvRequestsForOrder } from '@/features/crm/lab/env-request-service'

const patchSchema = z.object({
  envConfig: z.record(z.string(), z.string().nullable()),
})

/**
 * GET/PATCH /api/my-orders/[id]/env — buyer (or admin) owner_private (+ public_shared) env.
 * Integrator may GET (masked) so lab can see which owner keys are set; PATCH remains buyer/admin.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const { id } = await context.params
  const order = await ProjectOrderService.getById(id)
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const admin = isPlatformAdmin(session.user.role)
  const isBuyer = order.userId === session.user.id
  const isIntegrator = order.integratorId === session.user.id
  if (!admin && !isBuyer && !isIntegrator) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const hideOwnerPrivateValues = !admin && !isBuyer
  const dep = await ProjectDeploymentService.getOrCreate(id)
  const masked = ProjectDeploymentService.toMasked(dep, { hideOwnerPrivateValues })
  const manifest = getEnvTemplateManifest()
  const ownerGroups = manifest.groups
    .map((g) => ({
      ...g,
      keys: g.keys.filter((k) => {
        const owner = getEnvKeyOwner(k.key)
        return owner === 'owner_private' || owner === 'public_shared'
      }),
    }))
    .filter((g) => g.keys.length > 0)

  return NextResponse.json({
    success: true,
    envConfig: masked.deployment.envConfig,
    groups: ownerGroups,
    readOnly: hideOwnerPrivateValues,
    essentials: manifest.essentials.filter((k) => {
      const owner = getEnvKeyOwner(k)
      return owner === 'owner_private' || owner === 'public_shared'
    }),
  })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const { id } = await context.params
  const order = await ProjectOrderService.getById(id)
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const admin = isPlatformAdmin(session.user.role)
  if (!admin && order.userId !== session.user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    assertEnvPatchAllowed(admin ? 'admin' : 'buyer', parsed.data.envConfig)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Env write denied' },
      { status: 403 },
    )
  }

  const dep = await ProjectDeploymentService.saveEnvConfig(id, parsed.data.envConfig)
  const writtenKeys = Object.keys(parsed.data.envConfig).filter(
    (k) => parsed.data.envConfig[k] !== null && parsed.data.envConfig[k] !== '',
  )
  if (writtenKeys.length) {
    void fulfillEnvRequestsForOrder(id, writtenKeys).catch(() => {})
  }

  const masked = ProjectDeploymentService.toMasked(dep, { hideOwnerPrivateValues: false })
  return NextResponse.json({
    success: true,
    envConfig: masked.deployment.envConfig,
    appliedOnNextDeploy: true,
  })
}
