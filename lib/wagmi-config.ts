/**
 * Modern Web3 Configuration using Wagmi v2 + Viem
 * Replaces legacy ethers.js integration with modern React hooks
 * 
 * PERFORMANCE NOTE: This config is created once at module level to prevent
 * React Strict Mode from re-initializing WalletConnect multiple times.
 */

import { createConfig, http } from 'wagmi'
import { mainnet, polygon, arbitrum, optimism, base } from 'wagmi/chains'
import { injected, metaMask, coinbaseWallet } from 'wagmi/connectors'
import { walletConnect } from '@wagmi/connectors'

// WalletConnect Project ID - REQUIRED for production
// Get your project ID from: https://cloud.walletconnect.com
// Without a valid project ID, you'll see 403 Forbidden errors from Reown Config API
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

// Only include WalletConnect connector if we have a valid project ID
// This prevents 403 errors in development and allows graceful degradation
const getConnectors = () => {
  const baseConnectors = [
    injected(),
    metaMask(),
    coinbaseWallet({
      appName: 'Ring Platform',
      appLogoUrl: 'https://ring-platform.org/logo.png'
    })
  ]

  // Add WalletConnect only if we have a real project ID (not demo/undefined)
  if (projectId && projectId !== 'demo-project-id') {
    baseConnectors.push(
      walletConnect({ 
        projectId,
        metadata: {
          name: 'Ring Platform',
          description: 'Free, open-source platform for digital cities',
          url: 'https://ring-platform.org',
          icons: ['https://ring-platform.org/logo.png']
        },
        showQrModal: true
      }) as any // Type assertion for connector compatibility
    )
  } else if (typeof window !== 'undefined') {
    console.warn('[WalletConnect] No valid project ID found. WalletConnect disabled. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable.')
  }

  return baseConnectors
}

// Singleton wagmiConfig - Created once at module level
// This prevents React Strict Mode from re-initializing WalletConnect
export const wagmiConfig = createConfig({
  chains: [mainnet, polygon, arbitrum, optimism, base],
  connectors: getConnectors(),
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [base.id]: http()
  },
  ssr: true, // Enable server-side rendering support
})

// Re-export commonly used hooks and utilities
export { WagmiProvider, useAccount, useConnect, useDisconnect, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt, useEstimateGas, useGasPrice, useSwitchChain, useChainId } from 'wagmi'

// Type exports
export type { Config } from 'wagmi'
