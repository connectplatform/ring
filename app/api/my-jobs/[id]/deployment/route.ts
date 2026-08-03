import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { requireOrderLabAccess, labAuthDenied } from '@/features/crm/lab/lab-auth'
import { ProjectDeploymentService } from '@/features/crm/lab/deployment-service'
import { RING_EDGES } from '@/features/crm/lab/k8s-edge-client'

const patchSchema = z.object({
  edge: z.enum(['us', 'fi', 'ua']).optional(),
  projectUrl: z.string().nullable().optional(),
  projectName: z.string().nullable().optional(),
  imageTag: z.string().nullable().optional(),
  namespace: z.string().optional(),
  deploymentName: z.string().optional(),
  secretName: z.string().optional(),
  configMapName: z.string().optional(),
  envConfig: z.record(z.string(), z.string().nullable()).optional(),
})

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const { id } = await context.params
  const access = await requireOrderLabAccess(id)
  if (labAuthDenied(access)) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const dep = await ProjectDeploymentService.getOrCreate(id)
  const masked = ProjectDeploymentService.toMasked(dep, {
    hideOwnerPrivateValues: access.role === 'integrator',
  })
  return NextResponse.json({
    success: true,
    ...masked,
    role: access.role,
    edgeLabels: RING_EDGES,
  })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const { id } = await context.params
  const access = await requireOrderLabAccess(id)
  if (labAuthDenied(access)) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }
  if (access.role === 'buyer') {
    return NextResponse.json({ error: 'Buyers cannot modify deployment' }, { status: 403 })
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const body = parsed.data

  // Namespace lock fields: admin only (integrators may PATCH imageTag / envConfig / projectUrl)
  if (
    access.role !== 'admin' &&
    (body.namespace !== undefined ||
      body.projectName !== undefined ||
      body.deploymentName !== undefined ||
      body.edge !== undefined ||
      body.secretName !== undefined ||
      body.configMapName !== undefined)
  ) {
    return NextResponse.json(
      {
        error:
          'Only admins can set namespace, project name, deployment name, edge, or secret/config names',
      },
      { status: 403 },
    )
  }

  if (body.envConfig) {
    const { assertEnvPatchAllowed } = await import('@/features/crm/lab/env-key-ownership')
    try {
      assertEnvPatchAllowed(access.role === 'admin' ? 'admin' : 'integrator', body.envConfig)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Env write denied' },
        { status: 403 },
      )
    }
    await ProjectDeploymentService.saveEnvConfig(id, body.envConfig)
  }

  const { envConfig: _e, ...rest } = body
  const hasMeta = Object.values(rest).some((v) => v !== undefined)
  const dep = hasMeta
    ? await ProjectDeploymentService.patch(id, rest)
    : await ProjectDeploymentService.getOrCreate(id)

  return NextResponse.json({
    success: true,
    ...ProjectDeploymentService.toMasked(dep, {
      hideOwnerPrivateValues: access.role === 'integrator',
    }),
    role: access.role,
    edgeLabels: RING_EDGES,
  })
}
