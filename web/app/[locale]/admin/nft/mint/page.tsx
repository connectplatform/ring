import type { Metadata } from 'next'
import { connection } from 'next/server'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import { isSuperadmin, isPlatformAdmin } from '@/features/auth/user-role'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { Button } from '@/components/ui/button'
import { listNftGateTemplatesResolved, getNftCollectionMint, getNftCollectionUri, getNftCollectionSymbol, isNftGatesEnabled } from '@/features/nft-gates/config'
import { AdminNftTemplatesClient } from '@/features/admin/nft/admin-nft-templates-client'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'

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
    path: 'admin',
    pathname: '/admin/nft/mint',
    robots: { index: false, follow: false },
  })
}

export default async function AdminNftMintPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  const session = await auth()
  if (!session?.user) redirect(ROUTES.LOGIN(locale))
  if (!isPlatformAdmin(session.user.role) && !isSuperadmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  const t = await getTranslations('modules.admin')
  const adminLabels = buildModulesAdminLabels(t)
  const { resolveTemplateArtPrompt } = await import('@/features/nft-gates/art-prompt')
  const templates = isNftGatesEnabled()
    ? (await listNftGateTemplatesResolved()).map((tpl) => ({
        ...tpl,
        imagePrompt: resolveTemplateArtPrompt(tpl.imagePrompt),
      }))
    : []

  return (
    <AdminWrapper locale={locale} pageContext="web3" labels={adminLabels}>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">NFT Gate Mint</h1>
            <p className="text-muted-foreground mt-1">
              Preview four art variations in a fullscreen modal, pick one, then mint / activate
              `activeTemplateAsset` per slug via Metaplex Core (ledger-dev when collectionMint unset).
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={ROUTES.ADMIN_NFT_TEMPLATES(locale)}>Templates</Link>
          </Button>
        </div>
        <AdminNftTemplatesClient
          locale={locale}
          templates={templates}
          collectionMint={getNftCollectionMint()}
          collectionUri={getNftCollectionUri()}
          collectionSymbol={getNftCollectionSymbol()}
          tokenSymbol={getNativeTokenSymbol()}
        />
      </div>
    </AdminWrapper>
  )
}
