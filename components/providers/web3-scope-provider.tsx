'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import type { State } from 'wagmi'
import { pathNeedsWeb3, pathnameWithoutLocaleClient } from '@/lib/pathname-without-locale'

const Web3Provider = dynamic(
  () => import('@/providers/web3-provider').then((mod) => ({ default: mod.Web3Provider })),
  { ssr: false, loading: () => null },
)

function useWagmiInitialState(): State | undefined {
  const [initialState, setInitialState] = useState<State | undefined>(undefined)

  useEffect(() => {
    import('@/lib/wagmi-config').then(({ wagmiConfig }) => {
      import('wagmi').then(({ cookieToInitialState }) => {
        setInitialState(cookieToInitialState(wagmiConfig, document.cookie))
      })
    })
  }, [])

  return initialState
}

type Web3ScopeProviderProps = {
  children: React.ReactNode
}

/**
 * Mount wagmi on crypto routes only (lazy chunk + cookie hydration).
 * Root layout mounts above NextIntlClientProvider — use `next/navigation` pathname + locale strip.
 */
function Web3ScopeProviderInner({ children }: Web3ScopeProviderProps) {
  const pathname = usePathname()
  const pathWithoutLocale = pathnameWithoutLocaleClient(pathname ?? '/')
  const initialState = useWagmiInitialState()

  if (!pathNeedsWeb3(pathWithoutLocale)) {
    return <>{children}</>
  }

  return <Web3Provider initialState={initialState}>{children}</Web3Provider>
}

export function Web3ScopeProvider({ children }: Web3ScopeProviderProps) {
  return (
    <Suspense fallback={<>{children}</>}>
      <Web3ScopeProviderInner>{children}</Web3ScopeProviderInner>
    </Suspense>
  )
}
