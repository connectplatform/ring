import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { LocalePageProps } from '@/utils/page-props'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { auth } from '@/auth'
import {
  getUserByUsername,
  projectPublicPersonalPage,
} from '@/features/auth/services/get-user-by-username'
import {
  hasMemberPrivileges,
  hasRoleAtLeast,
  resolveSessionUserRole,
  UserRolesArray,
} from '@/features/auth/user-role'
import { acceptsProfileDms } from '@/features/auth/lib/personal-page-sections'
import { maybePrivatePersonalPageShell } from '@/features/auth/lib/personal-page-route-gate'
import { recordPersonalPageView } from '@/features/analytics/lib/personal-page-analytics'
import UserProfileWrapper from '@/components/wrappers/user-profile-wrapper'
import { MessageUserButton } from '@/features/auth/components/message-user-button'
import { PublicProfileSections } from '@/features/auth/components/public-profile-sections'
import ProfileListings from '@/features/nft-market/components/profile-listings'
import { getNftMarketListings } from '@/features/nft-market/services/listing-query'
import { isMemberCollectionsEnabled, isNftMarketplaceEnabled } from '@/features/nft-gates/config'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
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

  const handle = user.username || username

  if (!user.publicProfile) {
    return {
      title: `@${handle}`,
      description: `Contact @${handle}`,
      robots: { index: false, follow: false },
    }
  }

  const projected = projectPublicPersonalPage(user)
  const displayName = projected.name || handle
  const description = projected.bio || `${displayName} on Ring Platform`

  return buildLocalizedMetadata({
    locale,
    path: 'profile.user',
    pathname: `/${encodeURIComponent(username)}`,
    variables: { username: displayName, description },
    fallback: {
      title: `${displayName} | Profile`,
      description,
    },
  })
}

export default async function PublicProfilePage(
  props: LocalePageProps<PublicProfileParams>,
) {
  const params = await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}

  const validLocale: Locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : routing.defaultLocale

  setRequestLocale(validLocale)

  const username = params.username
  const asRaw = (searchParams as Record<string, string | string[] | undefined>).as
  const asValue = Array.isArray(asRaw) ? asRaw[0] : asRaw
  const asVisitor = asValue === 'visitor'

  const user = await getUserByUsername(username)
  if (!user) return notFound()

  const profileUsername = user.username || username
  const session = await auth()
  const isOwner = Boolean(session?.user?.id && session.user.id === user.id)
  const visitorRole = resolveSessionUserRole(session?.user?.role as string)
  const dmsOk = acceptsProfileDms(user.acceptProfileDms)
  const canContact =
    Boolean(session?.user?.id) &&
    !isOwner &&
    dmsOk &&
    hasRoleAtLeast(visitorRole, UserRolesArray.subscriber)

  const privateShell = maybePrivatePersonalPageShell({
    user,
    session,
    locale: validLocale,
    username,
  })
  if (privateShell) return privateShell

  const viewAsVisitor = isOwner && asVisitor
  const showOwnerChrome = isOwner && !viewAsVisitor

  const projected = projectPublicPersonalPage(user)
  const ownerRole = visitorRole
  const showCreateCta =
    showOwnerChrome && isMemberCollectionsEnabled() && hasMemberPrivileges(ownerRole)
  const showSellCta = showOwnerChrome && isNftMarketplaceEnabled()
  const initialListings = await getNftMarketListings({
    sellerUsername: profileUsername,
    status: 'active',
    limit: 12,
  })

  void (async () => {
    if (isOwner) return
    await recordPersonalPageView({
      username: profileUsername,
      profileUserId: user.id,
      locale: validLocale,
      path: `/${validLocale}/${profileUsername}`,
    })
  })().catch(() => undefined)

  const t = await getTranslations('modules.profile')

  return (
    <UserProfileWrapper locale={validLocale} username={username}>
      <div className="mx-auto max-w-4xl px-4">
        {showOwnerChrome ? (
          <div className="mb-4 flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={`${ROUTES.PUBLIC_PROFILE(profileUsername, validLocale)}?as=visitor`}>
                {t('viewAsVisitor') || 'View as visitor'}
              </Link>
            </Button>
          </div>
        ) : null}
        {viewAsVisitor ? (
          <div className="mb-4">
            <Button asChild variant="outline" size="sm">
              <Link href={ROUTES.PUBLIC_PROFILE(profileUsername, validLocale)}>
                {t('exitVisitorPreview') || 'Exit visitor preview'}
              </Link>
            </Button>
          </div>
        ) : null}

        <div className="flex items-center gap-4">
          {projected.photoURL && (
            <Image
              src={projected.photoURL}
              alt={projected.name || projected.username || username}
              className="h-20 w-20 rounded-full"
              width={80}
              height={80}
            />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">
                {projected.name || projected.username || username}
              </h1>
              {!viewAsVisitor ? (
                <MessageUserButton
                  targetUserId={user.id}
                  targetUserName={projected.name || projected.username}
                  locale={validLocale}
                  acceptProfileDms={dmsOk}
                />
              ) : null}
              <Button asChild variant="outline" size="sm">
                <Link href={ROUTES.PUBLIC_PROFILE_PLAYER(profileUsername, validLocale)}>
                  {t('publicNavPlayer') || 'Player'}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={ROUTES.PUBLIC_PROFILE_GAMES(profileUsername, validLocale)}>
                  {t('publicNavGames') || 'Games'}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={ROUTES.PUBLIC_PROFILE_IMG(profileUsername, validLocale)}>
                  {t('publicNavGallery') || 'Gallery'}
                </Link>
              </Button>
              {showOwnerChrome ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={ROUTES.PROFILE_SONGS(validLocale)}>
                    {t('publicNavManageSongs') || 'Manage songs'}
                  </Link>
                </Button>
              ) : null}
            </div>
            {projected.username ? (
              <p className="text-muted-foreground">@{projected.username}</p>
            ) : null}
          </div>
        </div>

        <PublicProfileSections
          user={projected}
          canContact={canContact}
          isOwner={isOwner}
          isAuthenticated={Boolean(session?.user?.id)}
          visitorPreview={viewAsVisitor}
          visitorName={session?.user?.name || ''}
          visitorEmail={session?.user?.email || ''}
          signInHref={ROUTES.LOGIN(validLocale)}
        />

        <section className="mt-10">
          <h2 className="text-xl font-medium">{t('nftsForSale') || 'NFTs for sale'}</h2>
          <div className="mt-4">
            <ProfileListings
              username={profileUsername}
              locale={validLocale}
              initialPage={initialListings}
            />
          </div>
        </section>

        {showOwnerChrome && (showSellCta || showCreateCta) ? (
          <section className="mt-10">
            <h2 className="text-xl font-medium">
              {t('nftExhibition') || 'NFT Exhibition'}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('nftExhibitionHint') ||
                'Sell verified KEYS gates or create on-platform member collections.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {showSellCta ? (
                <Button asChild>
                  <Link href={ROUTES.NFT_MARKET_SELL(validLocale)}>
                    {t('sellKeysGate') || 'Sell KEYS gate'}
                  </Link>
                </Button>
              ) : null}
              {showCreateCta ? (
                <Button asChild variant="outline">
                  <Link href={ROUTES.NFT_CREATE(validLocale)}>
                    {t('createMint') || 'Create / mint'}
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="ghost">
                <Link href={ROUTES.NFT_MARKET(validLocale)}>
                  {t('browseMarket') || 'Browse market'}
                </Link>
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </UserProfileWrapper>
  )
}
