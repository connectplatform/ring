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
import CreateListingForm from '../../../components/nft/forms/create-listing-form'
import { getNftMarketListings } from '@/features/nft-market/services/listing-query'
import Image from 'next/image'

// Define the expected route params for this page
type PublicProfileParams = { username: string }

/**
 * Generate SEO metadata dynamically for the user profile page.
 * - Determines the locale, then looks up user by username.
 * - If user doesn't exist, returns empty metadata.
 * - Constructs title and description based on user information.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; username: string }>
}): Promise<Metadata> {
  const { locale: localeParam, username } = await params

  // Determine locale: fallback to default if the param does not match allowed locales
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set up Next Intl locale at request time for translations/localization
  setRequestLocale(locale)

  // Fetch the user by username
  const user = await getUserByUsername(username)
  if (!user) {
    // If user not found, return empty metadata. This will also result in a 404 at page level.
    return {}
  }

  // Derive display name and description for the user
  const displayName = user.name || user.username || username
  const description = user.bio || `${displayName} on Ring Platform`

  // Build and return localized SEO metadata
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

/**
 * PublicProfilePage component
 * - Receives the locale and username params (possibly async from Next).
 * - Looks up the correct locale, then fetches user.
 * - Shows profile, NFT listings, and a Create Listing form if the user exists.
 * - Returns a 404 page if user does not exist.
 */
export default async function PublicProfilePage(props: LocalePageProps<PublicProfileParams>) {
  // TODO: In React 19 + Next 16, potentially use the new `use` hook with async functions to fetch data while rendering to simplify data dependencies.
  // e.g., `const params = use(props.params)`
  // See: https://react.dev/reference/react/use

  // Await the possibly-promise params object
  const params = await props.params

  // Validate locale, fallback if not allowed
  const validLocale: Locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : routing.defaultLocale

  // Extract username from params
  const username = params.username

  // Fetch user data
  const user = await getUserByUsername(username)
  if (!user) return notFound() // Show 404 page if user does not exist
  const profileUsername = user.username || username
  const initialListings = await getNftMarketListings({
    sellerUsername: profileUsername,
    status: 'active',
    limit: 12,
  })

  // Render user profile UI
  return (
    <UserProfileWrapper locale={validLocale} username={username}>
      <div className="max-w-4xl mx-auto">
        {/* Profile header with avatar and user info */}
        <div className="flex items-center gap-4">
          {/* User avatar if available */}
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
              {/* Display user name or fallback to username/param */}
              <h1 className="text-2xl font-semibold">{user.name || user.username || username}</h1>
              {/* Button to send a message to the user */}
              <MessageUserButton
                targetUserId={user.id}
                targetUserName={user.name || user.username}
                locale={validLocale}
              />
            </div>
            {/* Show @username handle */}
            {user.username && <p className="text-muted-foreground">@{user.username}</p>}
            {/* Show user bio if present */}
            {user.bio && <p className="mt-2 max-w-2xl">{user.bio}</p>}
          </div>
        </div>

        {/* Section for NFTs that the user has listed for sale */}
        <section className="mt-10">
          <h2 className="text-xl font-medium">NFTs for sale</h2>
          <div className="mt-4">
            <ProfileListings
              username={profileUsername}
              locale={validLocale}
              initialPage={initialListings}
            />
          </div>
        </section>

        {/* Section for creating a new NFT listing (shows listing form) */}
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
