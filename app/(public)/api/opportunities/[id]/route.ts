import { NextRequest, NextResponse } from 'next/server'
import { deleteOpportunity } from '@/features/opportunities/services/delete-opportunity'
import { getOpportunityById, OpportunityNotFoundError, OpportunityAccessDeniedError } from '@/features/opportunities/services/get-opportunity-by-id'
import { getEntityById } from '@/features/entities/services/get-entity-by-id'
import { updateOpportunity } from '@/features/opportunities/services/update-opportunity'
import { Opportunity } from '@/features/opportunities/types'
import { RouteHandlerProps } from '@/types/next-page'

/**
 * Handle GET: Retrieve a single opportunity by ID.
 * 
 * @param req - The request object
 * @param context - The context object containing the route parameters
 * @returns A response with the opportunity or an error
 */
export async function GET(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>
) {
  // Get the ID from the route params (Next.js 15 style)
  const params = await context.params
  const { id } = params

  try {
    // Use unified service with built-in authentication and authorization
    const opportunity = await getOpportunityById(id)
    
    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    // Fetch associated entity for convenience in detail views
    let entity = null
    try {
      entity = await getEntityById(opportunity.organizationId)
    } catch (e) {
      // If entity lookup fails, continue; client can handle null entity
      entity = null
    }

    return NextResponse.json({ opportunity, entity }, { status: 200 })
  } catch (error) {
    if (error instanceof OpportunityAccessDeniedError) {
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      } else {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }
    if (error instanceof OpportunityNotFoundError) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * Handle PUT: Update an existing opportunity by ID.
 * 
 * @param req - The request object
 * @param context - The context object containing the route parameters
 * @returns A response with the updated opportunity or an error
 */
export async function PUT(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>
) {
  // Get the ID from the route params (Next.js 15 style)
  const params = await context.params
  const { id } = params

  try {
    // Extract request body
    const body: Partial<Opportunity> = await req.json()

    // Update the opportunity (this will handle authentication internally)
    const updateSuccess = await updateOpportunity(id, body)
    if (!updateSuccess) {
      return NextResponse.json({ error: 'Opportunity update failed' }, { status: 400 })
    }

    // Retrieve the updated opportunity using unified service
    const updatedOpportunity = await getOpportunityById(id)
    if (!updatedOpportunity) {
      return NextResponse.json({ error: 'Opportunity not found after update' }, { status: 404 })
    }

    return NextResponse.json(updatedOpportunity, { status: 200 })
  } catch (error) {
    if (error instanceof OpportunityAccessDeniedError) {
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      } else {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }
    if (error instanceof OpportunityNotFoundError) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * Handle DELETE: Delete an opportunity by ID.
 * 
 * @param req - The request object
 * @param context - The context object containing the route parameters
 * @returns A response with a success message or an error
 */
export async function DELETE(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>
) {
  // Get the ID from the route params (Next.js 15 style)
  const params = await context.params
  const { id } = params

  try {
    // Delete the opportunity (this will handle authentication internally)
    const success = await deleteOpportunity(id)
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete opportunity' }, { status: 400 })
    }

    return NextResponse.json({ message: 'Opportunity deleted successfully' }, { status: 200 })
  } catch (error) {
    if (error instanceof OpportunityAccessDeniedError) {
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      } else {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }
    if (error instanceof OpportunityNotFoundError) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * Prevent caching for this route
 */
