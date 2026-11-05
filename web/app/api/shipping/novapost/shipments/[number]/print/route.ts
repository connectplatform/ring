import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { getNovaPostJwt, novaPostApiKey, novaPostSend } from '@/lib/shipping/nova-post'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ number: string }> },
) {
  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { number } = await context.params
  const apiKey = novaPostApiKey()
  if (!apiKey) return NextResponse.json({ error: 'Nova Post is not configured' }, { status: 400 })
  const jwt = await getNovaPostJwt(apiKey)
  const response = await novaPostSend(
    'GET',
    `/shipments/print?numbers[]=${encodeURIComponent(number)}`,
    jwt,
  )
  if (!response.ok || !response.buffer) {
    return NextResponse.json({ error: `Nova Post HTTP ${response.status}` }, { status: 502 })
  }
  return new NextResponse(response.buffer, {
    headers: {
      'Content-Type': response.contentType || 'application/pdf',
      'Content-Disposition': `inline; filename="nova-post-${number}.pdf"`,
    },
  })
}
