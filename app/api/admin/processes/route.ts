import { NextResponse } from 'next/server'
import { connection } from 'next/server'
import { requireSuperadminApi } from '@/lib/auth/superadmin-api-guard'
import { ProcessConductor } from '@/lib/processes'

export async function GET() {
  await connection()

  const guard = await requireSuperadminApi()
  if (guard.ok === false) {
    return guard.response
  }

  try {
    const pipelines = await ProcessConductor.listPipelines()
    return NextResponse.json({ success: true, pipelines })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
