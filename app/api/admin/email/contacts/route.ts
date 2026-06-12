import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { getEmailContactService } from '@/services/email/crm/email-contact-service'

export async function GET(req: NextRequest) {
  await connection()
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const url = new URL(req.url)
  const contacts = await getEmailContactService().searchContacts({
    email: url.searchParams.get('email') ?? undefined,
    name: url.searchParams.get('name') ?? undefined,
    company: url.searchParams.get('company') ?? undefined,
    type: (url.searchParams.get('type') as never) ?? undefined,
    limit: 100,
  })

  return NextResponse.json({ contacts })
}

export async function POST(req: NextRequest) {
  await connection()
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const body = await req.json()
  if (!body?.email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }

  const contact = await getEmailContactService().getOrCreateContact(body.email, {
    name: body.name,
    company: body.company,
    type: body.type,
  })

  return NextResponse.json({ contact })
}
