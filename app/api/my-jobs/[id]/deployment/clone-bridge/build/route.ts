import { NextResponse, connection } from 'next/server'
import { requireOrderLabAccess, labAuthDenied } from '@/features/crm/lab/lab-auth'
import { runCloneBridgeBuild } from '@/features/crm/lab/clone-bridge-service'

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const { id } = await context.params
  const access = await requireOrderLabAccess(id)
  if (labAuthDenied(access)) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }
  if (access.role === 'buyer') {
    return NextResponse.json({ error: 'Buyers cannot build clone images' }, { status: 403 })
  }

  try {
    const result = await runCloneBridgeBuild(id)
    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Build failed'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
