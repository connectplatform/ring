'use client'

import { useState } from 'react'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import WalletActionsRail from '@/components/wallet/wallet-actions-rail'
import { CreditHistoryProvider } from '@/components/providers/credit-history-provider'
import { WalletListProvider } from '@/components/providers/wallet-list-provider'
import { WalletActivityProvider } from '@/components/providers/wallet-activity-provider'
import type { Locale } from '@/i18n/shared'

interface WalletWrapperProps {
  children: React.ReactNode
  locale: string
}

export default function WalletWrapper({ children, locale }: WalletWrapperProps) {
  const resolvedLocale = locale as Locale
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  return (
    <WalletListProvider>
      <WalletActivityProvider>
        <CreditHistoryProvider>
          <RingRightRailLayout
            isOpen={rightSidebarOpen}
            onToggle={setRightSidebarOpen}
            contentClassName="pb-24 md:pt-2 lg:pb-8"
            rightRail={
              <WalletActionsRail
                locale={resolvedLocale}
                onNavigate={() => setRightSidebarOpen(false)}
              />
            }
          >
            {children}
          </RingRightRailLayout>
        </CreditHistoryProvider>
      </WalletActivityProvider>
    </WalletListProvider>
  )
}
