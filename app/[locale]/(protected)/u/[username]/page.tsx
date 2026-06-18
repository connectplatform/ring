import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { LocalePageProps } from '@/utils/page-props'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { getUserByUsername } from '@/features/auth/services/get-user-by-username'
import UserProfileWrapper from '@/components/wrappers/user-profile-wrapper'
import { MessageUserButton } from '@/features/auth/components/message-user-button'
import ProfileListings from '@/features/nft-market/components/profile-listings'
import CreateListingForm from './create-listing-form'
import Image from 'next/image'

type PublicProfileParams = { username: string }

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
  if (!user) {
    return {}
  }
  const displayName = user.name || user.username || username
  const description = user.bio || `${displayName} on Ring Platform`
  return buildLocalizedMetadata({
    locale,
    path: 'profile.user',
    pathname: `/u/${encodeURIComponent(username)}`,
    variables: { username: displayName, description },
    fallback: {
      title: `${displayName} | Profile`,
      description,
    },
  })
}

export default async function PublicProfilePage(props: LocalePageProps<PublicProfileParams>) {
  const params = await props.params
  const validLocale: Locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : routing.defaultLocale

  const username = params.username
  const user = await getUserByUsername(username)
  if (!user) return notFound()

  return (
    <UserProfileWrapper locale={validLocale} username={username}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          {user.photoURL && (
            <Image
              src={user.photoURL}
              alt={user.name || user.username || username}
              className="h-20 w-20 rounded-full"
              width={80}
              height={80}
            />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">{user.name || user.username || username}</h1>
              <MessageUserButton
                targetUserId={user.id}
                targetUserName={user.name || user.username}
                locale={validLocale}
              />
            </div>
            {user.username && <p className="text-muted-foreground">@{user.username}</p>}
            {user.bio && <p className="mt-2 max-w-2xl">{user.bio}</p>}
          </div>
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-medium">NFTs for sale</h2>
          <div className="mt-4">
            <ProfileListings username={user.username || username} />
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-medium">Create Listing</h2>
          <div className="mt-4 max-w-xl">
            <CreateListingForm username={user.username || username} />
          </div>
        </section>
      </div>
    </UserProfileWrapper>
  )
}
