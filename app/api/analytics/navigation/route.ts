import { NextRequest, NextResponse } from 'next/server'

// POST handler that simply returns a JSON response with { ok: true }
export async function POST(request: NextRequest) {
  // TODO: Consider using improved error handling and input validation if accepting request body in Next.js 16
  // TODO: Evaluate using RequestHandler type if stricter typing or inference is desired
  return NextResponse.json({ ok: true }) // Sends a simple success response
}
