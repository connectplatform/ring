import { NextResponse, connection } from 'next/server'
import { getVerificationQueue } from '@/features/verification/services/get-verification-queue'
import { EntityPermissionError } from '@/lib/errors'

/**
 * Handler for GET /api/admin/verification/queue endpoint.
 * This endpoint fetches the current verification queue for admin users.
 */
export async function GET() {
  // Ensure a database connection is established.
  await connection()

  try {
    // Attempt to fetch the verification queue.
    const queue = await getVerificationQueue()
    // Return the queue with a success indication as JSON.
    return NextResponse.json({ success: true, queue })
  } catch (error) {
    // Handle errors specific to entity permissions, such as authentication and authorization.
    if (error instanceof EntityPermissionError) {
      // Status 401 for Authentication issues, otherwise 403 for Authorization.
      const status = error.message.includes('Authentication') ? 401 : 403
      return NextResponse.json({ error: error.message }, { status })
    }
    // General error fallback
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// TODO: Use Next.js 16 Route Handlers with typed request/response when available for better type inference and error handling.
// TODO: Consider using the new fetch/Server Actions if this data can be loaded on the client via server actions.