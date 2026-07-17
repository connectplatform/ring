import { connection, NextRequest, NextResponse } from 'next/server'
import { deleteOpportunity } from '@/features/opportunities/services/delete-opportunity'
import {
  getOpportunityById,
  OpportunityNotFoundError,
  OpportunityAccessDeniedError,
} from '@/features/opportunities/services/get-opportunity-by-id'
import { getEntityById } from '@/features/entities/services/get-entity-by-id'
import { updateOpportunity } from '@/features/opportunities/services/update-opportunity'
import { Opportunity } from '@/features/opportunities/types'
import { RouteHandlerProps } from '@/types/next-page'
import {
  OpportunityAuthError,
  OpportunityPermissionError,
  OpportunityQueryError,
} from '@/lib/errors'

/**
 * SSOT HTTP surface for a single opportunity:
 * GET / PUT|PATCH / DELETE  `/api/opportunities/[id]`
 *
 * UI mutations prefer Server Actions; this route is the canonical REST path.
 * Do not reintroduce verb-nested aliases (`/delete/[id]`, `/update`).
 */

function mapGetUpdateError(error: unknown): NextResponse {
  if (error instanceof OpportunityAccessDeniedError) {
    if (error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
  if (error instanceof OpportunityNotFoundError) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }
  if (error instanceof OpportunityAuthError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (error instanceof OpportunityPermissionError) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
  if (error instanceof OpportunityQueryError) {
    const message = error.message || ''
    if (message.includes('not found')) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }
    return NextResponse.json({ error: message || 'Request failed' }, { status: 400 })
  }
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
}

export async function GET(
  _req: NextRequest,
  context: RouteHandlerProps<{ id: string }>,
) {
  await connection()
  const { id } = await context.params

  try {
    const opportunity = await getOpportunityById(id)

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    let entity = null
    try {
      entity = await getEntityById(opportunity.organizationId)
    } catch {
      entity = null
    }

    return NextResponse.json({ opportunity, entity }, { status: 200 })
  } catch (error) {
    return mapGetUpdateError(error)
  }
}

async function updateById(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>,
) {
  await connection()
  const { id } = await context.params

  try {
    const body: Partial<Opportunity> = await req.json()

    const updateSuccess = await updateOpportunity(id, body)
    if (!updateSuccess) {
      return NextResponse.json({ error: 'Opportunity update failed' }, { status: 400 })
    }

    const updatedOpportunity = await getOpportunityById(id)
    if (!updatedOpportunity) {
      return NextResponse.json({ error: 'Opportunity not found after update' }, { status: 404 })
    }

    return NextResponse.json(updatedOpportunity, { status: 200 })
  } catch (error) {
    return mapGetUpdateError(error)
  }
}

/** Full/partial update — canonical write path. */
export async function PUT(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>,
) {
  return updateById(req, context)
}

/** Same as PUT (REST clients often send PATCH for partial bodies). */
export async function PATCH(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>,
) {
  return updateById(req, context)
}

export async function DELETE(
  _req: NextRequest,
  context: RouteHandlerProps<{ id: string }>,
) {
  await connection()
  const { id } = await context.params

  if (!id) {
    return NextResponse.json({ error: 'Invalid ID parameter' }, { status: 400 })
  }

  try {
    const success = await deleteOpportunity(id)
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete opportunity' }, { status: 400 })
    }
    return NextResponse.json({ message: 'Opportunity deleted successfully' }, { status: 200 })
  } catch (error) {
    return mapGetUpdateError(error)
  }
}
