import { NextResponse, connection } from 'next/server'
import { requireOrderLabAccess, labAuthDenied } from '@/features/crm/lab/lab-auth'
import {
  runCloneBridgeScaffold,
  getCloneBridgeJobStatus,
} from '@/features/crm/lab/clone-bridge-service'

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
    return NextResponse.json({ error: 'Buyers cannot scaffold clones' }, { status: 403 })
  }

  try {
    const result = await runCloneBridgeScaffold(id)
    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Scaffold failed'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const { id } = await context.params
  const access = await requireOrderLabAccess(id)
  if (labAuthDenied(access)) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }
  const jobName = new URL(request.url).searchParams.get('job')
  if (!jobName) {
    return NextResponse.json({ error: 'job query required' }, { status: 400 })
  }
  try {
    const status = await getCloneBridgeJobStatus(jobName)
    return NextResponse.json({ success: true, job: status })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Job status failed'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
