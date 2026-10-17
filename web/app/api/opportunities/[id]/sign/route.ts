import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { getDatabaseService, initializeDatabase } from '@/lib/database'
import { logger } from '@/lib/logger'

/**
 * POST /api/opportunities/[id]/sign
 * Records an authenticated resident's advisory signature on a civic petition opportunity.
 */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: 'Opportunity ID is required' }, { status: 400 })
    }

    await initializeDatabase()
    const db = getDatabaseService()
    const existingResult = await db.findById<Record<string, unknown>>('opportunities', id)

    if (!existingResult.success || !existingResult.data) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    const rawDoc = existingResult.data as unknown as Record<string, unknown>
    const docData =
      rawDoc.data && typeof rawDoc.data === 'object' && !Array.isArray(rawDoc.data)
        ? (rawDoc.data as Record<string, unknown>)
        : rawDoc

    const existingMetadata: Record<string, unknown> =
      docData.metadata && typeof docData.metadata === 'object' && !Array.isArray(docData.metadata)
        ? (docData.metadata as Record<string, unknown>)
        : rawDoc.metadata && typeof rawDoc.metadata === 'object' && !Array.isArray(rawDoc.metadata)
          ? (rawDoc.metadata as Record<string, unknown>)
          : {}

    const signedUserIds: string[] = Array.isArray(existingMetadata.signedUserIds)
      ? existingMetadata.signedUserIds.map(String).filter(Boolean)
      : []

    const parsedTarget = Number(existingMetadata.signatureTarget)
    const signatureTarget =
      Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : 250

    const parsedCount = Number(existingMetadata.signatureCount)
    const currentSignatureCount =
      Number.isFinite(parsedCount) && parsedCount >= 0
        ? parsedCount
        : Math.max(1, signedUserIds.length)

    if (signedUserIds.includes(session.user.id)) {
      return NextResponse.json(
        {
          success: true,
          alreadySigned: true,
          signatureCount: Math.max(currentSignatureCount, signedUserIds.length),
          signatureTarget,
        },
        { status: 200 },
      )
    }

    const nextSignedUserIds = [...signedUserIds, session.user.id]
    const signatureCount = Math.max(currentSignatureCount + 1, nextSignedUserIds.length)
    const updatedMetadata: Record<string, unknown> = {
      ...existingMetadata,
      signedUserIds: nextSignedUserIds,
      signatureCount,
      signatureTarget,
    }

    const updateResult = await db.update('opportunities', id, {
      metadata: updatedMetadata,
      updatedAt: new Date().toISOString(),
    })

    if (!updateResult.success) {
      throw updateResult.error || new Error('Failed to update opportunity signature metadata')
    }

    return NextResponse.json(
      {
        success: true,
        alreadySigned: false,
        signatureCount,
        signatureTarget,
      },
      { status: 200 },
    )
  } catch (error) {
    logger.error('api.opportunities.sign.error', {
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Unable to sign petition: Internal Server Error' },
      { status: 500 },
    )
  }
}
