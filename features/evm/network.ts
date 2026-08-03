export interface EvmNetwork {
  chainId: number
  name: string
  rpcUrl: string
  blockExplorerUrl?: string
}

import { getEvmChainId, getEvmRpcUrl } from '@/lib/ring-config-chain'

export const POLYGON_MAINNET: EvmNetwork = {
  chainId: getEvmChainId(),
  name: 'polygon',
  rpcUrl: getEvmRpcUrl(),
  blockExplorerUrl: 'https://polygonscan.com',
}

export function getDefaultNetwork(): EvmNetwork {
  return POLYGON_MAINNET
}


