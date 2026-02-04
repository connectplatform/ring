'use client'

import { ReactNode, useMemo } from 'react'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { wagmiConfig } from '@/lib/wagmi-config'
import { mainnet, polygon, arbitrum, optimism, base } from 'wagmi/chains'

// RainbowKit styles imported dynamically to prevent render-blocking
// The CSS is loaded when Web3Provider is dynamically imported
import '@rainbow-me/rainbowkit/styles.css'

// Singleton QueryClient - Created once and reused across all instances
// This prevents React Strict Mode from creating multiple QueryClient instances
let globalQueryClient: QueryClient | null = null

function getQueryClient() {
  if (!globalQueryClient) {
    globalQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5, // 5 minutes
          gcTime: 1000 * 60 * 10, // 10 minutes
        },
      },
    })
  }
  return globalQueryClient
}

interface Web3ProviderProps {
  children: ReactNode
}

export function Web3Provider({ children }: Web3ProviderProps) {
  const { theme } = useTheme()
  
  // Use singleton QueryClient to prevent React Strict Mode double-initialization issues
  const queryClient = getQueryClient()

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={theme === 'dark' ? darkTheme() : lightTheme()}
          appInfo={{
            appName: 'Ring Platform',
            learnMoreUrl: 'https://ring-platform.org/docs/web3',
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
