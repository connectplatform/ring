export interface MarketAddresses {
  MARKET: string
}

export interface FeeConfig {
  marketFeeBps: number // 100 = 1%
  feeRecipient: string
}

export interface MarketConfig {
  addresses: MarketAddresses
  fees: FeeConfig
}

export const DEFAULT_MARKET_CONFIG: MarketConfig = {
  addresses: {
    MARKET: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '0x0000000000000000000000000000000000000000'
  },
  fees: {
    marketFeeBps: Number(process.env.NEXT_PUBLIC_MARKET_FEE_BPS || 0),
    feeRecipient: process.env.NEXT_PUBLIC_MARKET_FEE_RECIPIENT || '0x0000000000000000000000000000000000000000'
  }
}


