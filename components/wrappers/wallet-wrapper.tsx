'use client'

import { useState, useCallback, useMemo } from 'react'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import WalletActionsRail from '@/components/wallet/wallet-actions-rail'
import { CreditHistoryProvider } from '@/components/providers/credit-history-provider'
import { WalletListProvider } from '@/components/providers/wallet-list-provider'
import { WalletActivityProvider } from '@/components/providers/wallet-activity-provider'
import type { Locale } from '@/i18n/shared'

interface WalletWrapperProps {
  children: React.ReactNode
  locale: Locale
}

export default function WalletWrapper({ children, locale }: WalletWrapperProps) {
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  const closeRail = useCallback(() => setRightSidebarOpen(false), [])

  const rightRail = useMemo(
    () => <WalletActionsRail locale={locale} onNavigate={closeRail} />,
    [locale, closeRail],
  )

  return (
    <WalletListProvider>
      <WalletActivityProvider>
        <CreditHistoryProvider>
          <RingRightRailLayout
            isOpen={rightSidebarOpen}
            onToggle={setRightSidebarOpen}
            contentClassName="pb-24 md:pt-2 lg:pb-8"
            rightRail={rightRail}
          >
            {children}
          </RingRightRailLayout>
        </CreditHistoryProvider>
      </WalletActivityProvider>
    </WalletListProvider>
  )
}
