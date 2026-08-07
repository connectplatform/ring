import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { z } from 'zod'

// Handler for POST requests to update order status
export async function POST(
  req: NextRequest, context: { params: Promise<{ id: string }> }
) {
  // Establish database connection
  await connection() // Next.js 16: opt out of prerendering

  const { id } = await context.params

  // Authenticate and check for platform admin privileges
  const session = await auth()
  // If user is not logged in or not a platform admin, forbid access
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Define validation schema for order status using zod
    const schema = z.object({
      status: z.enum([
        'new',
        'paid',
        'processing',
        'shipped',
        'completed',
        'canceled'
      ])
    })
    // Parse and validate the request body
    const body = await req.json()
    const parsed = schema.safeParse(body)
    // Return bad request if body is invalid
    if (!parsed.success)
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })

    // Update order status in the database/service
    await StoreOrdersService.adminUpdateOrderStatus(id, parsed.data.status)

    // Return success response
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    // Handle and return server error for unexpected issues
    return NextResponse.json(
      { error: e?.message || 'Failed' },
      { status: 500 }
    )
  }
}

// TODO: Consider using middleware/edge runtime for authentication for native Next.js 16 patterns.
// TODO: Validate that 'id' exists and is in expected format before proceeding to update order.
// TODO: For scalability/reactivity, consider using server actions (React 19/Next 16 native) where possible instead of API routes as legacy route handlers may be eventually phased out.
