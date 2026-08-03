import type { Metadata } from 'next'
import { connection } from 'next/server'
import { redirect, notFound } from 'next/navigation'
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
import { CrmTaskEscrowDetailClient } from '@/features/tasks/components/crm-task-escrows-admin'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  return buildLocalizedMetadata({
    locale,
    path: 'admin.crm.taskEscrow',
    pathname: '/admin/crm/task-escrows',
    robots: { index: false, follow: false },
  })
}

export default async function AdminCrmTaskEscrowDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  await connection()
  const { locale: localeParam, id } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  const escrow = await taskEscrowService.getById(id)
  if (!escrow) notFound()

  const messages = new MessageService()
  const message = await messages.getMessage(escrow.messageId)
  const meta = message ? parseTaskMetadata(message) : null

  return (
    <CrmAdminShell pageContext="crm-task-escrows">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Task escrow</h1>
          <p className="font-mono text-sm text-muted-foreground">{id}</p>
        </div>
        <CrmTaskEscrowDetailClient
          escrowId={id}
          locale={locale}
          initial={{
            escrow,
            messagePreview: message?.content ?? '',
            taskStatus: meta?.status ?? null,
            reporterUserId: escrow.reporterUserId,
            assigneeUserId: escrow.assigneeUserId ?? meta?.assigneeUserId ?? null,
          }}
        />
      </div>
    </CrmAdminShell>
  )
}
