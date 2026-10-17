import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { matchNeedAcrossEcosystem } from '@/lib/ai/need-matcher'
import { getDatabaseService, initializeDatabase } from '@/lib/database'
import { logger } from '@/lib/logger'

const matchNeedBodySchema = z.object({
  needText: z
    .string()
    .trim()
    .min(3, 'needText must be at least 3 characters')
    .max(500, 'needText must be at most 500 characters'),
  locale: z.string().trim().optional(),
  saveNeed: z.boolean().optional(),
  district: z.string().trim().max(120).optional(),
})

/**
 * POST /api/opportunities/match-need
 *
 * Matches a resident's free-text need across active public opportunities,
 * civic/commercial entities, and store products. Optionally persists the stated
 * need as a public `community_mutual_aid` opportunity when `saveNeed === true`
 * and an authenticated session is present.
 */
export async function POST(req: NextRequest) {
  await connection()

  try {
    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 },
      )
    }

    const parsed = matchNeedBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? 'Invalid request parameters',
        },
        { status: 400 },
      )
    }

    const { needText, locale, saveNeed, district } = parsed.data
    const session = await auth()
    const viewerUserId = session?.user?.id

    const { matches, usedLlm } = await matchNeedAcrossEcosystem({
      needText,
      locale,
      limit: 6,
      viewerUserId,
    })

    let opportunityId: string | null = null

    if (saveNeed === true && viewerUserId) {
      try {
        await initializeDatabase()
        const db = getDatabaseService()
        const now = new Date().toISOString()
        const expiration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

        const createResult = await db.create('opportunities', {
          type: 'community_mutual_aid',
          status: 'active',
          visibility: 'public',
          isConfidential: false,
          title: needText.slice(0, 100),
          briefDescription: needText,
          createdBy: viewerUserId,
          organizationId: '',
          category: 'community_mutual_aid',
          location: district || '',
          tags: ['mutual-aid', 'community-need'],
          requiredSkills: [],
          requiredDocuments: [],
          attachments: [],
          applicants: [],
          applicantCount: 0,
          contactInfo: {
            linkedEntity: '',
            contactAccount: viewerUserId,
          },
          dateCreated: now,
          dateUpdated: now,
          expirationDate: expiration,
          metadata: {
            civicKind: 'community_mutual_aid',
            aidDirection: 'need',
            ...(district ? { district } : {}),
          },
        })

        if (createResult.success && createResult.data?.id) {
          opportunityId = createResult.data.id
        }
      } catch (persistError) {
        logger.warn('api.opportunities.match-need: Failed to persist community_mutual_aid need', {
          error: persistError instanceof Error ? persistError.message : String(persistError),
        })
      }
    }

    return NextResponse.json(
      {
        success: true,
        opportunityId,
        usedLlm,
        matches,
      },
      { status: 200 },
    )
  } catch (error) {
    logger.error('api.opportunities.match-need.error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to match community need',
      },
      { status: 500 },
    )
  }
}
