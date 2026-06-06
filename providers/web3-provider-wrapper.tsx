'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { State } from 'wagmi'

const Web3Provider = dynamic(
  () => import('@/providers/web3-provider').then(mod => ({ default: mod.Web3Provider })),
  { ssr: false }
)

interface Web3ProviderWrapperProps {
  children: ReactNode
}

export function Web3ProviderWrapper({ children }: Web3ProviderWrapperProps) {
  const [initialState, setInitialState] = useState<State | undefined>(undefined)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // All wagmi imports are lazy here — they execute only after hydration,
    // keeping the server-rendered chunk graph free of wagmi/WalletConnect code.
    import('@/lib/wagmi-config').then(({ wagmiConfig }) => {
      import('wagmi').then(({ cookieToInitialState }) => {
        const state = cookieToInitialState(wagmiConfig, document.cookie)
        setInitialState(state)
        setReady(true)
      })
    })
  }, [])

  if (!ready) {
    return <>{children}</>
  }

  return <Web3Provider initialState={initialState}>{children}</Web3Provider>
}
