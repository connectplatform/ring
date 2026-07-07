import { NextResponse } from 'next/server'
import { adminBlockEntity } from '@/features/entities/services/entity-moderation'
import { EntityAuthError, EntityPermissionError } from '@/lib/errors'

export async function POST(request: Request) {
  try {
    // Parse the JSON body from the request
    const body = await request.json()
    // Extract entityId and reason as strings, defaulting to empty string if missing
    const entityId = String(body.entityId ?? '')
    const reason = String(body.reason ?? '')

    // If entityId is not provided, return 400 Bad Request
    if (!entityId) {
      return NextResponse.json({ error: 'entityId required' }, { status: 400 })
    }

    // Attempt to block the entity with an optional reason
    await adminBlockEntity(entityId, reason)
    // Return success response if the block operation succeeds
    return NextResponse.json({ success: true })
  } catch (error) {
    // Handle authorization error by returning 401 Unauthorized
    if (error instanceof EntityAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    // Handle permission error by returning 403 Forbidden
    if (error instanceof EntityPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    // Handle all other errors by returning 500 Internal Server Error with the error message
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Block failed' },
      { status: 500 },
    )
  }
}

// TODO: Consider using Zod or another validation library for request body validation with Next.js 16 for improved type safety and error reporting.
// TODO: When using Next.js 16 (App Route Handlers), validate input shape and types before casting to string.
// TODO: In Next.js 16, enable edge runtime if possible for faster serverless execution if business logic allows.