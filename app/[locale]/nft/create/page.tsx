import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { hasMemberPrivileges, resolveSessionUserRole } from '@/features/auth/user-role'
import { isMemberCollectionsEnabled } from '@/features/nft-gates/config'
import { listMemberCollectionsForUser } from '@/features/nft-market/member/member-collection-service'
import { listOwnedMemberMints } from '@/features/nft-market/member/member-mint-service'
import { NftCreateWizard } from '@/features/nft-market/components/nft-create-wizard'
import { ROUTES } from '@/constants/routes'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'nft.create',
    pathname: '/nft/create',
    fallback: {
      title: 'Create NFT Collection | Ring Platform',
      description: 'Create on-platform Metaplex Core collections and mint tradeable NFTs.',
    },
  })
}

export default async function NftCreatePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) {
    redirect(`${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.NFT_CREATE(locale))}`)
  }
  if (!isMemberCollectionsEnabled()) {
    redirect(ROUTES.NFT_MARKET(locale))
  }
  const role = resolveSessionUserRole(session.user.role as string)
  if (!hasMemberPrivileges(role)) {
    redirect(`${ROUTES.MEMBERSHIP(locale)}?reason=nft-create`)
  }

  const [collections, mints] = await Promise.all([
    listMemberCollectionsForUser(session.user.id),
    listOwnedMemberMints(session.user.id),
  ])

  return <NftCreateWizard locale={locale} collections={collections} mints={mints} />
}
