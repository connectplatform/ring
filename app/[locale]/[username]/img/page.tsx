import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { getUserByUsername } from '@/features/auth/services/get-user-by-username'
import { listPublicGalleryByOwner } from '@/features/file-cabinet/service'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { ROUTES } from '@/constants/routes'
import { Button } from '@/components/ui/button'
import { auth } from '@/auth'
import { PublicProfileImgGallery } from '@/features/file-cabinet/components/public-profile-img-gallery'
import {
  maybePrivatePersonalPageShell,
  privatePersonalPageRobots,
} from '@/features/auth/lib/personal-page-route-gate'

type Params = { username: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; username: string }>
}): Promise<Metadata> {
  const { locale: localeParam, username } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  const user = await getUserByUsername(username)
  if (!user) return {}
  const displayName = user.name || user.username || username
  if (!user.publicProfile) {
    return {
      title: `@${user.username || username} — Gallery`,
      ...privatePersonalPageRobots(),
    }
  }
  return buildLocalizedMetadata({
    locale,
    path: 'profile.img',
    pathname: `/${encodeURIComponent(username)}/img`,
    variables: { username: displayName },
    fallback: {
      title: `${displayName} — Gallery`,
      description: `Public media gallery by ${displayName}`,
    },
  })
}

export default async function PublicProfileImgPage(props: LocalePageProps<Params>) {
  const { locale: localeParam, username } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const user = await getUserByUsername(username)
  if (!user) notFound()

  const session = await auth()
  const privateShell = maybePrivatePersonalPageShell({
    user,
    session,
    locale,
    username,
  })
  if (privateShell) return privateShell

  const isOwner = Boolean(session?.user?.id && session.user.id === user.id)
  const items = await listPublicGalleryByOwner(user.id)
  const displayName = user.name || user.username || username
  const t = await getTranslations('modules.fileCabinet')

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href={ROUTES.PUBLIC_PROFILE(username, locale)} className="hover:underline">
            @{user.username || username}
          </Link>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {displayName} — {t('publicImgTitle')}
          </h1>
          {isOwner ? (
            <Button asChild>
              <Link href={ROUTES.PROFILE_GALLERY(locale)}>{t('publicImgManage')}</Link>
            </Button>
          ) : null}
        </div>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center space-y-4">
          <p className="text-muted-foreground">{t('publicImgEmpty')}</p>
          {isOwner ? (
            <Button asChild>
              <Link href={ROUTES.PROFILE_GALLERY(locale)}>{t('publicImgAdd')}</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <PublicProfileImgGallery items={items} />
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={ROUTES.PUBLIC_PROFILE(username, locale)}>Back to profile</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={ROUTES.PUBLIC_PROFILE_PLAYER(username, locale)}>Player</Link>
        </Button>
      </div>
    </div>
  )
}
