import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { requireSuperadminApi } from '@/lib/auth/superadmin-api-guard'
import { ProcessConductor } from '@/lib/processes'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()

  const guard = await requireSuperadminApi()
  if (guard.ok === false) {
    return guard.response
  }

  const { id } = await context.params
  const limit = Math.min(
    100,
    Math.max(1, Number(new URL(request.url).searchParams.get('limit') ?? '20') || 20),
  )

  try {
    const runs = await ProcessConductor.getRunHistory(id, limit)
    return NextResponse.json({ success: true, pipelineId: id, runs })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
