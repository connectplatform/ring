import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { z } from 'zod'

// Handle POST requests to update the status of an order by platform admins only
export async function POST(
  req: NextRequest, 
  { params }: { params: { id: string } }
) {
  // Opt out of static prerendering for this route (Next.js 16)
  await connection()

  // Authenticate user session
  const session = await auth()
  // Only allow access if user is logged in and is a platform admin
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    // Validate the incoming request body schema with Zod
    const schema = z.object({ 
      status: z.enum(['new', 'paid', 'processing', 'shipped', 'completed', 'canceled']) 
    })

    // Parse request body as JSON
    const body = await req.json()
    
    // Safe parse for validation
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      // 400 Bad Request if body doesn't match schema
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }
    // Update the order status for given order id
    await StoreOrdersService.adminUpdateOrderStatus(params.id, parsed.data.status)
    // Respond with success
    return NextResponse.json({ ok: true })
  } catch (error) {
    // Respond with error if anything goes wrong
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}

// TODO: Consider leveraging Next.js 16 middleware for authentication to centralize admin protection.
// TODO: Use built-in Request/Response helpers from Next.js (such as request.json() with edge routes/streams) if targeting Edge runtime in the future.
// TODO: Explore typed request body validation/mapping for stronger type safety and improved developer experience.
