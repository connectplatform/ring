import React from 'react'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { WikiWorkspace } from '@/features/wiki/components/wiki-workspace'
import { resolveWikiActor } from '@/features/wiki/resolve-wiki-actor'
import { ensureTenantSchema } from '@/features/wiki/wiki-service'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  await connection()
  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)
  const t = await getTranslations('modules.admin')
  return {
    title: `${t('wiki') || 'Wiki'} | Ring Platform`,
    description: t('wikiDescription') || 'Project knowledge wiki',
  }
}

export default async function AdminWikiPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()
  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)
  const t = await getTranslations('modules.admin')

  const session = await auth()
  if (!session?.user) {
    redirect(
      `${ROUTES.LOGIN(validLocale)}?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_WIKI(validLocale))}`,
    )
  }
  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }

  const actor = await resolveWikiActor({
    userId: session.user.id!,
    role: session.user.role,
  })
  await ensureTenantSchema(actor)

  const adminLabels = buildModulesAdminLabels(t)

  return (
    <AdminWrapper locale={validLocale} pageContext="wiki" labels={adminLabels}>
      <div className="container mx-auto px-0 py-0">
        <WikiWorkspace locale={validLocale} initialVaultKey="tenant" />
      </div>
    </AdminWrapper>
  )
}
