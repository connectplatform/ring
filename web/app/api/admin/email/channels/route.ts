import { NextResponse } from 'next/server'
import { connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { loadCrmChannels, validateCrmChannels } from '@/features/email-crm/pipeline/imap/config'

/**
 * GET /api/admin/email/channels — read-only CRM channel status (no secrets).
 */
export async function GET() {
  await connection()
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const channels = loadCrmChannels()
  const validation = validateCrmChannels(channels)

  return NextResponse.json({
    channels: channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      flow: ch.flow,
      mailbox: ch.config.mailbox,
      imapHost: ch.config.host,
      imapUser: ch.config.user,
      smtpHost: ch.config.smtp.host,
      smtpUser: ch.config.smtp.auth.user,
      hasImapPassword: Boolean(ch.config.password),
      hasSmtpPassword: Boolean(ch.config.smtp.auth.pass),
    })),
    validation,
  })
}
