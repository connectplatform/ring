export interface PreparedTransaction {
  to: string
  data?: string
  value?: string
}

export interface TransferRequest {
  to: string
  amount: string
  tokenSymbol?: 'DAAR' | 'DAARION' | 'USDT'
}

export interface TransactionResult {
  txHash: string
}

/**
 * Placeholder for EVM transaction preparation.
 * In production, integrate a provider (e.g., viem) behind a thin adapter.
 */
export async function prepareTokenTransfer(req: TransferRequest): Promise<PreparedTransaction> {
  // This is a stub to keep Ring decoupled from any specific EVM library
  // The caller will sign and send using their wallet provider
  return {
    to: req.to,
    data: undefined,
    value: req.amount
  }
}


