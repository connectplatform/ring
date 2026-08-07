import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { connection } from 'next/server'
import DeleteEntityConfirm from '@/features/entities/components/delete-entity-confirm'
import {
  assertEntityOwnerOrAdmin,
  EntityOwnershipError,
} from '@/features/entities/lib/assert-entity-owner'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

type PageProps = {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  return buildLocalizedMetadata({
    locale,
    path: 'entities.delete',
    pathname: '/entities/[id]/delete',
    robots: { index: false, follow: false },
  })
}

export default async function DeleteEntityPage({ params }: PageProps) {
  await connection()
  const { locale: localeParam, id } = await params
  const locale: Locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  const session = await auth()
  if (!session?.user) {
    redirect(`${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.ENTITY_DELETE(id, locale))}`)
  }

  try {
    const { entity } = await assertEntityOwnerOrAdmin(id)

    return (
      <div className="container mx-auto px-6 py-8">
        <DeleteEntityConfirm entity={entity} locale={locale} />
      </div>
    )
  } catch (error) {
    if (error instanceof EntityOwnershipError) {
      if (error.message === 'Entity not found') notFound()
      redirect(ROUTES.UNAUTHORIZED(locale))
    }
    throw error
  }
}
