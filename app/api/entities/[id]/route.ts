import { NextRequest, NextResponse, connection } from 'next/server'
import { deleteEntity } from '@/features/entities/services/delete-entity'
import { getEntityById, EntityNotFoundError, EntityAccessDeniedError } from '@/features/entities/services/get-entity-by-id'
import { updateEntity } from '@/features/entities/services/update-entity'
import { entityPatchSchema } from '@/features/entities/lib/entity-update-schema'
import { RouteHandlerProps } from '@/types/next-page'
import type { Entity } from '@/features/entities/types'

function mapDeleteEntityError(error: unknown): NextResponse {
  if (error instanceof EntityAccessDeniedError) {
    if (error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
  if (error instanceof EntityNotFoundError) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
  }
  if (error instanceof Error) {
    if (error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message.includes('permission') || error.message.includes('Permission')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
  }
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
}

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
 * Handle PATCH: Partial update (canonical path; replaces /api/entities/update/{id}).
 */
export async function PATCH(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>
) {
  await connection()

  const params = await context.params
  const { id } = params

  if (!id) {
    return NextResponse.json({ error: 'Invalid ID parameter' }, { status: 400 })
  }

  let data: Partial<Entity>
  try {
    data = entityPatchSchema.parse(await req.json()) as Partial<Entity>
  } catch {
    return NextResponse.json({ error: 'Invalid entity data' }, { status: 400 })
  }

  try {
    const success = await updateEntity(id, data)
    if (!success) {
      return NextResponse.json({ error: 'Failed to update entity' }, { status: 400 })
    }

    const updatedEntity = await getEntityById(id)
    if (!updatedEntity) {
      return NextResponse.json({ error: 'Entity not found after update' }, { status: 404 })
    }

    return NextResponse.json(updatedEntity, { status: 200 })
  } catch (error) {
    if (error instanceof EntityAccessDeniedError) {
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    if (error instanceof EntityNotFoundError) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Access denied') || error.message.includes('permission')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * Handle DELETE: Delete an entity by ID.
 * Requires JSON body `{ "confirm": true }` (same contract as MCP destructive ops).
 */
export async function DELETE(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>
) {
  await connection()

  const params = await context.params
  const { id } = params

  if (!id) {
    return NextResponse.json({ error: 'Invalid ID parameter' }, { status: 400 })
  }

  let body: { confirm?: boolean } | null = null
  try {
    body = await req.json()
  } catch {
    body = null
  }

  if (body?.confirm !== true) {
    return NextResponse.json(
      { error: 'Destructive operation requires confirm: true in request body' },
      { status: 400 },
    )
  }

  try {
    const success = await deleteEntity(id)
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete entity' }, { status: 400 })
    }

    return NextResponse.json({ message: 'Entity deleted successfully', id }, { status: 200 })
  } catch (error) {
    return mapDeleteEntityError(error)
  }
}