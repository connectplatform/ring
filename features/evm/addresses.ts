export interface TokenAddressMap {
  DAAR?: string
  DAARION?: string
  USDT?: string
  WETH?: string
  WPOL?: string
}

export const DEFAULT_TOKEN_ADDRESSES: TokenAddressMap = {
  // Placeholder addresses; configure via instance config in production
  DAAR: '0x0000000000000000000000000000000000000001',
  DAARION: '0x0000000000000000000000000000000000000002',
  USDT: '0x0000000000000000000000000000000000000003'
}

export function getTokenAddress(symbol: keyof TokenAddressMap, overrides?: TokenAddressMap): string | undefined {
  return (overrides && overrides[symbol]) || DEFAULT_TOKEN_ADDRESSES[symbol]
}


