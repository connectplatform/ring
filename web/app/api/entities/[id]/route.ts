import { NextRequest, NextResponse, connection } from 'next/server'
import { deleteEntity } from '@/features/entities/services/delete-entity'
import { getEntityById, EntityNotFoundError, EntityAccessDeniedError } from '@/features/entities/services/get-entity-by-id'
import { updateEntity } from '@/features/entities/services/update-entity'
import { entityPatchSchema } from '@/features/entities/lib/entity-update-schema'
import { RouteHandlerProps } from '@/types/next-page'
import type { Entity } from '@/features/entities/types'

// Helper to map deleteEntity errors to HTTP response codes/messages
function mapDeleteEntityError(error: unknown): NextResponse {
  // Map custom service-level access denied
  if (error instanceof EntityAccessDeniedError) {
    if (error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
  // Map not-found error to 404
  if (error instanceof EntityNotFoundError) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
  }
  // Fall back for general error instances
  if (error instanceof Error) {
    if (error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message.includes('permission') || error.message.includes('Permission')) {
      // Covers permission and access denied variations in message
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
  }
  // Fallback for unhandled error types
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
  // TODO: Use Next.js 16+ Route Handler context signature directly when supported (native route params)
  const params = await context.params
  const { id } = params

  try {
    // Main fetch for the entity; will throw on error (such as not allowed, not found)
    const entity = await getEntityById(id)
    // Defensive: check for nullish entity – typically getEntityById should throw for missing, but just in case
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }
    // Entity found: return it
    return NextResponse.json(entity, { status: 200 })
  } catch (error) {
    // Known error types mapped to specific HTTP codes/messages
    if (error instanceof EntityAccessDeniedError) {
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    if (error instanceof EntityNotFoundError) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }
    // TODO: Move error-response mapping to a utility for all CRUD methods, as with DELETE
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * Handle PUT: Update an existing entity by ID, replacing all fields.
 * 
 * @param req - The request object representing the incoming HTTP request
 * @param context - Contains the route parameters (i.e. id of the entity)
 * @returns The full, updated entity or an error message
 */
export async function PUT(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>
) {
  // TODO: Leverage Zod or Next.js validation helpers to validate full entity schema here, as in PATCH
  const params = await context.params
  const { id } = params

  try {
    // Parse the request JSON payload for the entity update body
    const body = await req.json()

    // Update the entity with new data. updateEntity returns boolean for success/failure
    // TODO: Refactor updateEntity to return the updated entity directly if possible
    const updateSuccess = await updateEntity(id, body)
    if (!updateSuccess) {
      // Update failed due to some application condition (bad input, invariant, etc)
      return NextResponse.json({ error: 'Entity update failed' }, { status: 400 })
    }

    // Double-check and fetch updated entity for response, in case of DB mutation
    const updatedEntity = await getEntityById(id)
    if (!updatedEntity) {
      // Updated entity could not be found (perhaps deleted or failed to commit)
      return NextResponse.json({ error: 'Entity not found after update' }, { status: 404 })
    }
    // Return the updated entity
    return NextResponse.json(updatedEntity, { status: 200 })
  } catch (error) {
    // Reuse same error-response mapping as GET
    if (error instanceof EntityAccessDeniedError) {
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    if (error instanceof EntityNotFoundError) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }
    // Unhandled or unknown error
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * Handle PATCH: Partial update of an entity by ID. Validates using Zod schema.
 * Mirrors the canonical partial-update pattern and replaces the old '/update' endpoint.
 */
export async function PATCH(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>
) {
  // Always ensure DB connection on mutation (idempotent call)
  await connection()

  // TODO: Native route params support in Next.js 16 for API handlers will simplify this
  // (would allow destructuring id directly from Route Handler signature)
  const params = await context.params
  const { id } = params

  // Fail fast if id param is missing/invalid
  if (!id) {
    return NextResponse.json({ error: 'Invalid ID parameter' }, { status: 400 })
  }

  let data: Partial<Entity>
  try {
    // Validate PATCH data using zod schema: only permitted keys/values
    data = entityPatchSchema.parse(await req.json()) as Partial<Entity>
  } catch {
    // Reject unvalidated/invalid patch data shape/content
    return NextResponse.json({ error: 'Invalid entity data' }, { status: 400 })
  }

  try {
    // Perform partial update, returns boolean on success
    const success = await updateEntity(id, data)
    if (!success) {
      // Update was not possible or violated integrity checks
      return NextResponse.json({ error: 'Failed to update entity' }, { status: 400 })
    }

    // Fetch and return updated entity as canonical representation
    const updatedEntity = await getEntityById(id)
    if (!updatedEntity) {
      // Could not find entity after supposedly-successful update
      return NextResponse.json({ error: 'Entity not found after update' }, { status: 404 })
    }

    return NextResponse.json(updatedEntity, { status: 200 })
  } catch (error) {
    // Extra error mapping for PATCH: permission and authorization edge cases
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
      // Covers both custom message and generic permission issues
      if (error.message.includes('Access denied') || error.message.includes('permission')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    // Unexpected errors
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * Handle DELETE: Delete an entity by ID.
 * Requires JSON body `{ "confirm": true }` to avoid accidental destruction.
 */
export async function DELETE(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>
) {
  // Always ensure DB connection for destructive/mutative operations.
  await connection()

  // TODO: Switch to destructured route param once Next.js 16+ enables it natively in Route Handler signature
  const params = await context.params
  const { id } = params

  // Aggressively validate presence of id
  if (!id) {
    return NextResponse.json({ error: 'Invalid ID parameter' }, { status: 400 })
  }

  // Attempt to decode an explicit confirmation from the request body
  let body: { confirm?: boolean } | null = null
  try {
    // Parse body, allow null fallback for non-JSON/non-object input
    body = await req.json()
  } catch {
    body = null
  }

  // Enforce explicit confirmation for destructive action safety
  if (body?.confirm !== true) {
    return NextResponse.json(
      { error: 'Destructive operation requires confirm: true in request body' },
      { status: 400 },
    )
  }

  try {
    // Attempt to delete entity by id; returns boolean
    const success = await deleteEntity(id)
    if (!success) {
      // Deletion failed (possibly due to referential integrity, or already deleted)
      return NextResponse.json({ error: 'Failed to delete entity' }, { status: 400 })
    }
    // Success: communicate deletion, including which id was affected
    return NextResponse.json({ message: 'Entity deleted successfully', id }, { status: 200 })
  } catch (error) {
    // Shared error mapping for delete-specific scenarios and constraints
    return mapDeleteEntityError(error)
  }
}