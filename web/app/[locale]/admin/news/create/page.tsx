import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { ArticleEditor } from '@/features/news/components/article-editor'
import type { Locale } from '@/i18n/shared'
import { connection } from 'next/server'
import { routing } from '@/i18n/routing'
import { getTranslations } from 'next-intl/server'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { isPlatformAdmin } from '@/features/auth/user-role'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)
  const t = await getTranslations('modules.admin')

  return {
    title: `${t('createArticle')} | Ring Platform`,
    description: t('newsManagementDescription'),
    robots: 'noindex, nofollow',
  }
}

export default async function CreateArticlePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)
  const t = await getTranslations('modules.admin')

  // Check authentication and admin role
  const session = await auth()

  if (!session?.user) {
    redirect(
      `${ROUTES.LOGIN(validLocale)}?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_NEWS_CREATE(validLocale))}`,
    )
  }

  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }

  const adminLabels = buildModulesAdminLabels(t)

  return (
    <AdminWrapper locale={validLocale} pageContext="news" labels={adminLabels}>
      <div className="container mx-auto px-0 py-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('createArticle')}
          </h1>
          <p className="text-muted-foreground">
            {t('newsManagementDescription')}
          </p>
        </div>

        <ArticleEditor
          mode="create"
          locale={validLocale}
        />
      </div>
    </AdminWrapper>
  )
}