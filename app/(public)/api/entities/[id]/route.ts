import { NextRequest, NextResponse } from 'next/server'
import { deleteEntity } from '@/features/entities/services/delete-entity'
import { getEntityById, EntityNotFoundError, EntityAccessDeniedError } from '@/features/entities/services/get-entity-by-id'
import { updateEntity } from '@/features/entities/services/update-entity'
import { RouteHandlerProps } from '@/types/next-page'

/**
 * Handle GET: Retrieve a single entity by ID.
 * 
 * @param req - The request object
 * @param context - The context object containing the route parameters
 * @returns A response with the entity or an error
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
    const entity = await getEntityById(id)
    
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    return NextResponse.json(entity, { status: 200 })
  } catch (error) {
    if (error instanceof EntityAccessDeniedError) {
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      } else {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }
    if (error instanceof EntityNotFoundError) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * Handle PUT: Update an existing entity by ID.
 * 
 * @param req - The request object
 * @param context - The context object containing the route parameters
 * @returns A response with the updated entity or an error
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
    const body = await req.json()

    // Update the entity (this will handle authentication internally)
    const updateSuccess = await updateEntity(id, body)
    if (!updateSuccess) {
      return NextResponse.json({ error: 'Entity update failed' }, { status: 400 })
    }

    // Retrieve the updated entity using unified service
    const updatedEntity = await getEntityById(id)
    if (!updatedEntity) {
      return NextResponse.json({ error: 'Entity not found after update' }, { status: 404 })
    }

    return NextResponse.json(updatedEntity, { status: 200 })
  } catch (error) {
    if (error instanceof EntityAccessDeniedError) {
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      } else {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }
    if (error instanceof EntityNotFoundError) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * Handle DELETE: Delete an entity by ID.
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
    // Delete the entity (this will handle authentication internally)
    const success = await deleteEntity(id)
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete entity' }, { status: 400 })
    }

    return NextResponse.json({ message: 'Entity deleted successfully' }, { status: 200 })
  } catch (error) {
    if (error instanceof EntityAccessDeniedError) {
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      } else {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }
    if (error instanceof EntityNotFoundError) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}