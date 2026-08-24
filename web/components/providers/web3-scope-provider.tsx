'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import type { State } from 'wagmi'
import { pathNeedsWeb3, pathnameWithoutLocaleClient } from '@/lib/pathname-without-locale'

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

type Web3ProviderComponent = ComponentType<{
  initialState?: State
  children: ReactNode
}>

type Web3ScopeProviderProps = {
  children: ReactNode
}

/**
 * Mount wagmi on crypto routes only (lazy chunk + cookie hydration).
 * Root layout mounts above NextIntlClientProvider — use `next/navigation` pathname + locale strip.
 *
 * Do not use next/dynamic `{ ssr: false }` here: Next.js 16 cacheComponents treats that as a
 * CSR bailout for the whole route. `/login` is a web3 path (wallet connect), so the old
 * pattern painted a white screen with only the metadata title.
 */
function Web3ScopeProviderInner({ children }: Web3ScopeProviderProps) {
  const pathname = usePathname()
  const pathWithoutLocale = pathnameWithoutLocaleClient(pathname ?? '/')
  const initialState = useWagmiInitialState()
  const [Web3Provider, setWeb3Provider] = useState<Web3ProviderComponent | null>(null)
  const needsWeb3 = pathNeedsWeb3(pathWithoutLocale)

  useEffect(() => {
    if (!needsWeb3) {
      setWeb3Provider(null)
      return
    }
    let cancelled = false
    import('@/providers/web3-provider').then((mod) => {
      if (!cancelled) setWeb3Provider(() => mod.Web3Provider)
    })
    return () => {
      cancelled = true
    }
  }, [needsWeb3])

  if (!needsWeb3 || !Web3Provider) {
    return <>{children}</>
  }

  return <Web3Provider initialState={initialState}>{children}</Web3Provider>
}

export function Web3ScopeProvider({ children }: Web3ScopeProviderProps) {
  // Do not pass `children` as the Suspense fallback — that slot is opaque in
  // the App Router and hydrating it twice freezes SSR chrome.
  return <Web3ScopeProviderInner>{children}</Web3ScopeProviderInner>
}
