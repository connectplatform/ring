import { NextResponse, connection } from 'next/server'
import { getEntityAnalytics } from '@/features/entities/services/get-entity-analytics'
import { EntityAuthError, EntityPermissionError } from '@/lib/errors'
import { RouteHandlerProps } from '@/types/next-page'

/**
 * Route handler for GET /api/entities/{id}/analytics.
 * Purpose: Returns analytics data for a specific entity (owner, member, or admin roles).
 * 
 * @param _req - The incoming Request object (unused in this handler).
 * @param context - Provides route parameters (must include 'id').
 */
export async function GET(
  _req: Request,
  context: RouteHandlerProps<{ id: string }>,
) {
  // Ensure the database connection is ready before doing any data fetching.
  await connection()

  // Fetch and validate 'id' from the route parameters.
  // Destructuring allows easy access, but if not present, immediately respond with a 400.
  const { id } = await context.params
  if (!id) {
    // Early return for missing or invalid ID parameter.
    return NextResponse.json({ error: 'Invalid ID parameter' }, { status: 400 })
  }

  try {
    // Try fetching analytics for the given entity ID.
    // This may throw for not found, permission issues, or other errors.
    const analytics = await getEntityAnalytics(id)
    // Successful fetch, respond with analytics data and HTTP 200.
    return NextResponse.json(analytics, { status: 200 })
  } catch (error) {
    // Handle known error cases with appropriate status codes and messages.

    // Authentication error: user not logged in, or authentication token invalid.
    if (error instanceof EntityAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    // Permission error: user lacks rights to access this resource.
    if (error instanceof EntityPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    // Entity not found: check for error message string for fallback 404.
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    // Fallback for unexpected or server-side errors.
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// TODO: Use zod or valibot for schema-based param validation & type-safe parsing.
// TODO: When available, use Next.js 16 route handler middlewares/native param validators for cleaner logic.
// TODO: If React 19 enables server actions in route handlers, consider replacing custom error -> response patterns with built-in error boundaries or Response.error helpers.
// TODO: Consider using native NextResponse.error or explicit typed error responses for more consistent error formatting in future Next.js versions.
// TODO: If getEntityAnalytics can throw additional custom errors, enumerate and handle them explicitly for improved clarity and safety.