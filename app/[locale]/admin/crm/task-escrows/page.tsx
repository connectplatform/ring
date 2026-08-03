import type { Metadata } from 'next'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { CrmAdminShell } from '@/features/admin/crm/crm-admin-shell'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { taskEscrowService } from '@/features/tasks/services/task-escrow-service'
import { MessageService } from '@/features/chat/services/message-service'
import { parseTaskMetadata } from '@/features/tasks/types'
import { CrmTaskEscrowsListClient } from '@/features/tasks/components/crm-task-escrows-admin'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  return buildLocalizedMetadata({
    locale,
    path: 'admin.crm.taskEscrows',
    pathname: '/admin/crm/task-escrows',
    robots: { index: false, follow: false },
  })
}

export default async function AdminCrmTaskEscrowsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  const escrows = await taskEscrowService.listAdminHeld(200)
  const messages = new MessageService()
  const rows = await Promise.all(
    escrows.map(async (escrow) => {
      const message = await messages.getMessage(escrow.messageId)
      const meta = message ? parseTaskMetadata(message) : null
      return {
        ...escrow,
        taskStatus: meta?.status ?? null,
        disputed: meta?.status === 'disputed',
        messagePreview: message?.content?.slice(0, 160) ?? '',
      }
    }),
  )
  const filtered = rows.filter((row) => row.paymentStatus === 'held' || row.disputed)

  return (
    <CrmAdminShell pageContext="crm-task-escrows">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Task escrows</h1>
          <p className="text-muted-foreground">
            Held chat task escrow funds and disputed tasks — release, refund, or cancel
          </p>
        </div>
        <CrmTaskEscrowsListClient escrows={filtered} locale={locale} />
      </div>
    </CrmAdminShell>
  )
}
