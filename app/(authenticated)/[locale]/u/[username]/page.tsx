import { notFound } from 'next/navigation'
import type { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates } from '@/i18n-config'
import { getUserByUsername } from '@/features/auth/services/get-user-by-username'
import ProfileListings from '@/features/nft-market/components/profile-listings'
import CreateListingForm from './create-listing-form'

type PublicProfileParams = { username: string }

export const dynamic = 'force-dynamic'

export default async function PublicProfilePage(props: LocalePageProps<PublicProfileParams>) {
  const params = await props.params
  const searchParams = await props.searchParams
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale

  const translations = loadTranslations(locale)
  const username = params.username
  const user = await getUserByUsername(username)
  if (!user) return notFound()

  const title = `${user.name || user.username || username} | Profile`
  const description = user.bio || `${user.username || username} on Ring`
  const canonicalUrl = `https://ring.ck.ua/${locale}/u/${encodeURIComponent(username)}`
  const alternates = generateHreflangAlternates(`/u/${encodeURIComponent(username)}`)

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
      ))}
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4">
          {user.photoURL && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt={user.name || user.username || username} className="h-20 w-20 rounded-full" />
          )}
          <div>
            <h1 className="text-2xl font-semibold">{user.name || user.username || username}</h1>
            {user.username && <p className="text-muted-foreground">@{user.username}</p>}
            {user.bio && <p className="mt-2 max-w-2xl">{user.bio}</p>}
          </div>
        </div>

        {/* NFTs for sale block */}
        <section className="mt-10">
          <h2 className="text-xl font-medium">NFTs for sale</h2>
          <div className="mt-4">
            <ProfileListings username={user.username || username} />
          </div>
        </section>

        {/* Owner-only: Quick create listing (basic draft) */}
        <section className="mt-10">
          <h2 className="text-xl font-medium">Create Listing</h2>
          <div className="mt-4 max-w-xl">
            <CreateListingForm username={user.username || username} />
          </div>
        </section>
      </div>
    </>
  )
}


