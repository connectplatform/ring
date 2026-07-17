'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { Store } from 'lucide-react'

export function NftPageShell({
  locale,
  children,
  header,
}: {
  locale: Locale
  children: React.ReactNode
  header?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const rightRail = useMemo(
    () => (
      <div className="space-y-3 p-1">
        <p className="text-sm font-semibold">NFT Exhibition</p>
        <Button asChild variant="outline" className="w-full justify-start" onClick={close}>
          <Link href={ROUTES.NFT_MARKET(locale)}>
            <Store className="mr-2 h-4 w-4" />
            Marketplace
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start" onClick={close}>
          <Link href={ROUTES.NFT_GATES(locale)}>Gates</Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start" onClick={close}>
          <Link href={ROUTES.NFT_COLLECTIONS(locale)}>Collections</Link>
        </Button>
        <Button asChild variant="secondary" className="w-full justify-start" onClick={close}>
          <Link href={ROUTES.NFT_CREATE(locale)}>Create / mint</Link>
        </Button>
      </div>
    ),
    [locale, close],
  )

  return (
    <RingRightRailLayout showRightRail flushCenterPane isOpen={open} onToggle={setOpen} rightRail={rightRail}>
      <DavinciCenterPane header={header}>{children}</DavinciCenterPane>
    </RingRightRailLayout>
  )
}
