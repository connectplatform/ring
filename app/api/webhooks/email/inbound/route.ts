import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { getEmailProcessor } from '@/services/email/email-processor'
import type { EmailReceivedEvent } from '@/services/email/imap/imap-listener'

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  await connection()

  const secret = process.env.WEBHOOK_EMAIL_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  const rawBody = await request.text()
  const bearer = request.headers.get('authorization')
  const signature = request.headers.get('x-email-webhook-signature')

  const authorized =
    bearer === `Bearer ${secret}` ||
    verifySignature(rawBody, signature, secret)

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = JSON.parse(rawBody) as {
    messageId: string
    from: string
    fromName?: string | null
    to?: string
    subject: string
    bodyText?: string | null
    bodyHtml?: string | null
    date?: string
    inReplyTo?: string | null
    references?: string[]
  }

  const event: EmailReceivedEvent = {
    uid: 0,
    messageId: body.messageId,
    from: body.from,
    fromName: body.fromName ?? null,
    to: body.to ?? 'info@ringdom.org',
    subject: body.subject,
    bodyText: body.bodyText ?? null,
    bodyHtml: body.bodyHtml ?? null,
    date: body.date ? new Date(body.date) : new Date(),
    headers: {},
    inReplyTo: body.inReplyTo ?? null,
    references: body.references ?? [],
    attachments: [],
    raw: {} as EmailReceivedEvent['raw'],
  }

  const processor = getEmailProcessor()
  await processor.ingestEvent(event)

  return NextResponse.json({ success: true, messageId: body.messageId })
}
