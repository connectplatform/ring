import 'server-only'

import { transferRingFromTreasury } from './treasury-transfer-service'
import { ringRawToUi } from '@/lib/wallet/ring-amount'

export async function executeAirdropTransfer(params: {
  recipientAddress: string
  amountRaw: bigint
}): Promise<{ txHash: string; amountUi: string }> {
  const result = await transferRingFromTreasury(params.recipientAddress, params.amountRaw)
  return {
    txHash: result.txHash,
    amountUi: ringRawToUi(params.amountRaw),
  }
}
