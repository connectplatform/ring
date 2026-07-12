import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { hasMemberPrivileges, resolveSessionUserRole } from '@/features/auth/user-role'
import { getMemberCollectionById } from '@/features/nft-market/member/member-collection-service'
import { listOwnedMemberMints } from '@/features/nft-market/member/member-mint-service'
import { NftCreateWizard } from '@/features/nft-market/components/nft-create-wizard'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; collectionId: string }>
}): Promise<Metadata> {
  const { locale: localeParam, collectionId } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  const collection = await getMemberCollectionById(collectionId)
  return buildLocalizedMetadata({
    locale,
    path: 'nft.create.collection',
    pathname: `/nft/create/${collectionId}`,
    variables: { name: collection?.name || collectionId },
    fallback: {
      title: `${collection?.name || 'Collection'} | Create NFT`,
      description: 'Manage your on-platform NFT collection.',
    },
  })
}

export default async function NftCreateCollectionPage({
  params,
}: {
  params: Promise<{ locale: string; collectionId: string }>
}) {
  const { locale: localeParam, collectionId } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) {
    redirect(
      `${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.NFT_CREATE_COLLECTION(collectionId, locale))}`,
    )
  }
  const role = resolveSessionUserRole(session.user.role as string)
  if (!hasMemberPrivileges(role)) {
    redirect(ROUTES.MEMBERSHIP(locale))
  }

  const collection = await getMemberCollectionById(collectionId)
  if (!collection || collection.creatorUserId !== session.user.id) notFound()

  const [collections, mints] = await Promise.all([
    Promise.resolve([collection]),
    listOwnedMemberMints(session.user.id, collectionId),
  ])

  return (
    <div className="space-y-4">
      <div className="mx-auto flex max-w-4xl justify-end px-1">
        <Button asChild variant="outline" size="sm">
          <Link href={ROUTES.NFT_CREATE(locale)}>All collections</Link>
        </Button>
      </div>
      <NftCreateWizard locale={locale} collections={collections} mints={mints} />
    </div>
  )
}
