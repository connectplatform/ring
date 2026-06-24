import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { requireSuperadminApi } from '@/lib/auth/superadmin-api-guard'
import { ProcessConductor } from '@/lib/processes'

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()

  const guard = await requireSuperadminApi()
  if (guard.ok === false) {
    return guard.response
  }

  const { id } = await context.params

  try {
    const { run, result } = await ProcessConductor.triggerManualRun(
      id,
      guard.session.user.id ?? guard.session.user.email ?? 'superadmin',
    )

    return NextResponse.json({
      success: run.status === 'success',
      run,
      result,
      error: run.error,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('Unknown pipeline') ? 404 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
