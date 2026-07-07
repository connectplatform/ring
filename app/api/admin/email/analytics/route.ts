import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { EmailAnalyticsService } from '@/features/email-crm/services/email-analytics-service'

// API route handler for GET requests to the analytics endpoint
export async function GET(req: NextRequest) {
  // Ensure a database connection is established before proceeding
  await connection()

  // Authorize the requesting user as an email admin
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    // If authorization fails, return an error response with the appropriate status
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  // Parse the request URL
  const url = new URL(req.url)
  // Get the 'range' query parameter, defaulting to '7d' if not present. Accepts only '7d', '30d', or '90d'.
  const range = (url.searchParams.get('range') ?? '7d') as '7d' | '30d' | '90d'

  // TODO: Consider validating the 'range' value more robustly and handling invalid input explicitly.
  // TODO: Next.js 13+ middleware can parse query params directly; revisit if API Route upgrades.

  // Retrieve aggregated analytics data for the requested range from the analytics service
  const analytics = await EmailAnalyticsService.getDashboard(range)

  // Return analytics data as a JSON response
  return NextResponse.json(analytics)
}
