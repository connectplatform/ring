import { loadCrmChannels, validateCrmChannels } from '@/features/email-crm/pipeline/imap/config'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'

export const GET = withMcpGuard(async () => {
  const channels = loadCrmChannels()
  const validation = validateCrmChannels(channels)

  return mcpOk({
    items: channels.map((ch) => ({
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
})
