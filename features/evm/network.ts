export interface EvmNetwork {
  chainId: number
  name: string
  rpcUrl: string
  blockExplorerUrl?: string
}

export const POLYGON_MAINNET: EvmNetwork = {
  chainId: 137,
  name: 'polygon',
  rpcUrl: 'https://polygon-rpc.com',
  blockExplorerUrl: 'https://polygonscan.com'
}

export function getDefaultNetwork(): EvmNetwork {
  return POLYGON_MAINNET
}


