'use client'

import { useState } from 'react'
import { useConnection } from 'wagmi'
import { Button } from '@/components/ui/button'
import { ConnectorPickerDialog } from './connector-picker-dialog'
import { ConnectedWalletMenu } from './connected-wallet-menu'

export type WalletShellLayout = 'page' | 'compact'

export interface WalletShellProps {
  /** compact: single account control for dense headers (e.g. multi-chain dashboard) */
  layout?: WalletShellLayout
}

export function WalletShell({ layout = 'page' }: WalletShellProps) {
  const { isConnected } = useConnection()
  const [connectOpen, setConnectOpen] = useState(false)

  if (!isConnected) {
    return (
      <>
        <Button
          type="button"
          onClick={() => setConnectOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Connect Wallet
        </Button>
        <ConnectorPickerDialog open={connectOpen} onOpenChange={setConnectOpen} />
      </>
    )
  }

  return <ConnectedWalletMenu variant={layout === 'compact' ? 'compact' : 'default'} />
}
