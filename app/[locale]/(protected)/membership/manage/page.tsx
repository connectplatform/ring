import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { isValidLocale, defaultLocale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { ROUTES } from '@/constants/routes'
import {
  resolveSessionUserRole,
  hasMemberPrivileges,
  hasConfidentialAccess,
  isPlatformAdmin,
} from '@/features/auth/user-role'
import { listOwnedGateAssets } from '@/features/nft-gates/purchase'
import { listActiveStakes } from '@/features/nft-gates/gate-escrow'
import { isNftGatesEnabled } from '@/features/nft-gates/config'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { SubscriptionManagement } from '@/components/membership/subscription-management'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Crown, Shield, KeyRound, Receipt } from 'lucide-react'

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
    path: 'membership',
    pathname: '/membership/manage',
    robots: { index: false, follow: false },
  })
}

export default async function MembershipManagePage(props: LocalePageProps) {
  await connection()
  const params = await props.params
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTES.LOGIN(locale))
  }

  const userId = session.user.id
  const role = resolveSessionUserRole(session.user.role)
  const nftEnabled = isNftGatesEnabled()

  const [owned, stakes, payments] = await Promise.all([
    nftEnabled ? listOwnedGateAssets(userId) : Promise.resolve([]),
    nftEnabled ? listActiveStakes(userId) : Promise.resolve([]),
    paymentTransactionService.listByUserId(userId, {
      purposes: ['membership_upgrade'],
      limit: 50,
    }),
  ])

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Manage membership</h1>
        <p className="text-muted-foreground">
          Subscription, role privileges, NFT gates, and membership payment history.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" asChild>
            <Link href={ROUTES.MEMBERSHIP(locale)}>Upgrade options</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={ROUTES.PROFILE(locale)}>Profile</Link>
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role & privileges
          </CardTitle>
          <CardDescription>Current platform role resolved from session SSOT.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant="default" className="text-sm capitalize">
            <Crown className="mr-1 h-3.5 w-3.5" />
            {role}
          </Badge>
          {hasMemberPrivileges(role) && <Badge variant="secondary">Member privileges</Badge>}
          {hasConfidentialAccess(role) && <Badge variant="secondary">Confidential</Badge>}
          {isPlatformAdmin(role) && <Badge variant="outline">Admin</Badge>}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Subscription</h2>
        <SubscriptionManagement />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            NFT feature gates
          </CardTitle>
          <CardDescription>
            Owned gate assets and active GateEscrow stakes that unlock membership features.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!nftEnabled ? (
            <p className="text-sm text-muted-foreground">NFT gates are disabled in ring-config.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium">Owned assets</p>
                  <p className="text-2xl font-semibold">{owned.length}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium">Active stakes</p>
                  <p className="text-2xl font-semibold">{stakes.length}</p>
                </div>
              </div>
              {stakes.length > 0 && (
                <ul className="space-y-2 text-sm">
                  {stakes.slice(0, 8).map((stake) => (
                    <li
                      key={`${stake.asset}-${stake.slug}`}
                      className="flex justify-between gap-2 rounded border px-3 py-2"
                    >
                      <span className="truncate font-mono text-xs">{stake.asset}</span>
                      <span className="text-muted-foreground">{stake.slug}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link href={ROUTES.NFT_GATES(locale)}>
                  Open NFT gates
                </Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Membership payment history
          </CardTitle>
          <CardDescription>Recent membership_upgrade payment transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No membership payments yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {payments.map((tx) => (
                <li
                  key={tx.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-mono text-xs">{tx.order_reference}</p>
                    <p className="text-muted-foreground">
                      {tx.processor} · {tx.status}
                      {tx.created_at ? ` · ${new Date(tx.created_at).toLocaleString()}` : ''}
                    </p>
                  </div>
                  <p className="font-medium tabular-nums">
                    {typeof tx.amount_minor === 'number'
                      ? (tx.amount_minor / 100).toFixed(2)
                      : '—'}{' '}
                    {(tx.currency || '').toUpperCase()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
