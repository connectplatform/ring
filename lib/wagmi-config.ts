/**
 * Web3 configuration: Wagmi v3 + viem 2.x
 *
 * Connector SDKs are explicit peer dependencies in Wagmi v3 — install
 * @metamask/connect-evm, @coinbase/wallet-sdk, @walletconnect/ethereum-provider
 * for the connectors you enable below.
 *
 * PERFORMANCE: Singleton config at module scope avoids Strict Mode double-init
 * of WalletConnect.
 *
 * RPC SSOT: Polygon transport uses getEvmRpcUrl() (env → Ankr fallback).
 * Default chain follows ring-config native EVM chainId when available.
 */

import { createConfig, http, cookieStorage, createStorage } from 'wagmi'
import { mainnet, polygon, arbitrum, optimism, base } from 'wagmi/chains'
import { injected, metaMask, coinbaseWallet } from 'wagmi/connectors'
import { walletConnect } from '@wagmi/connectors'
import { getEvmRpcUrl } from '@/lib/ring-config-chain'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
const polygonRpc = getEvmRpcUrl()

const getConnectors = () => {
  const baseConnectors = [
    injected(),
    metaMask(),
    coinbaseWallet({
      appName: 'Ring Platform',
      appLogoUrl: 'https://ring-platform.org/logo.png',
    }),
  ]

  if (projectId && projectId !== 'demo-project-id') {
    baseConnectors.push(
      walletConnect({
        projectId,
        metadata: {
          name: 'Ring Platform',
          description: 'Free, open-source platform for digital cities',
          url: 'https://ring-platform.org',
          icons: ['https://ring-platform.org/logo.png'],
        },
        showQrModal: true,
      })
    )
  } else if (typeof window !== 'undefined') {
    console.warn(
      '[WalletConnect] No valid project ID found. WalletConnect disabled. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable.'
    )
  }

  return baseConnectors
}

/** Multi-chain explorer set; Polygon is the Ring EVM default (native when chains.native=evm). */
export const wagmiConfig = createConfig({
  chains: [polygon, mainnet, arbitrum, optimism, base],
  connectors: getConnectors(),
  transports: {
    [polygon.id]: http(polygonRpc),
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
  },
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
})

export {
  WagmiProvider,
  useBalance,
  useChainId,
  useChains,
  useConnect,
  useConnectors,
  useConnection,
  useDisconnect,
  useEstimateGas,
  useGasPrice,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'

export type { Config } from 'wagmi'
