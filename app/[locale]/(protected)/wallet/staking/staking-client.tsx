'use client'

import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StakingPanel } from '@/features/staking/components/staking-panel'
import type { StakingPosition } from '@/features/staking/types'
import { AlertTriangle } from 'lucide-react'
import type { Locale } from '@/i18n/shared'

interface WalletStakingClientProps {
  locale: Locale
}

export default function WalletStakingClient({ locale: _locale }: WalletStakingClientProps) {
  const t = useTranslations('modules.wallet')
  const { data: session } = useSession()
  const address = session?.user?.wallets?.[0]?.address

  const positions: StakingPosition[] = []

  const notConnected = !address

  const noop = async () => {
    /* wired when wagmi signer is connected on this page */
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('staking')}</h1>
        <p className="text-muted-foreground mt-1">{t('stakingDescription')}</p>
      </div>

      {notConnected && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{t('stakingConnectWallet')}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('stakingPools')}</CardTitle>
        </CardHeader>
        <CardContent>
          <StakingPanel
            positions={positions}
            onStakeDaar={noop}
            onStakeDaarion={noop}
            onUnstakeDaar={noop}
            onUnstakeDaarion={noop}
            onClaimDaar={noop}
            onClaimDaarion={noop}
          />
        </CardContent>
      </Card>
    </div>
  )
}
