export interface EvmNetwork {
  chainId: number
  name: string
  rpcUrl: string
  blockExplorerUrl?: string
}

import { getPolygonRpcUrl } from '@/lib/web3/polygon-rpc'

export const POLYGON_MAINNET: EvmNetwork = {
  chainId: 137,
  name: 'polygon',
  rpcUrl: getPolygonRpcUrl(),
  blockExplorerUrl: 'https://polygonscan.com'
}

export function getDefaultNetwork(): EvmNetwork {
  return POLYGON_MAINNET
}


