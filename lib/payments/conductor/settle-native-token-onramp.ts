import 'server-only'

import { getRingPerUsdRate } from '@/features/wallet/services/ring-token-oracle'
import { getNativeWallet } from '@/lib/wallet/user-wallet-db'
import { transferTokenFromTreasury } from '@/features/wallet/chains/solana/treasury-transfer-service'
import { createWalletTransaction } from '@/lib/wallet/wallet-transaction-db'
import { nativeTokenUiToRaw, nativeTokenRawToUi } from '@/lib/wallet/native-token-amount'
import {
  getNativeTokenDecimals,
  getNativeTokenSymbol,
  getNativeChain,
} from '@/lib/ring-config-chain'
import { screenWalletAddress } from '@/lib/wallet/compliance-guard'
import { logger } from '@/lib/logger'

/**
 * After card/PayPal capture for purpose native_token_onramp:
 * convert fiat → RING (desk SSOT: nativeOut = fiat / ringPerUsd) and transfer from treasury.
 */
export async function settleNativeTokenOnramp(params: {
  userId: string
  fiatAmount: number
  orderReference: string
  processor: string
}): Promise<{ ok: boolean; txHash?: string; tokenAmount?: string; error?: string }> {
  const { userId, fiatAmount, orderReference, processor } = params

  if (!Number.isFinite(fiatAmount) || fiatAmount <= 0) {
    return { ok: false, error: 'Invalid fiat amount' }
  }

  if (getNativeChain() !== 'solana') {
    return { ok: false, error: 'Native token onramp requires Solana native chain' }
  }

  try {
    const ringPerUsd = Number(await getRingPerUsdRate())
    if (!Number.isFinite(ringPerUsd) || ringPerUsd <= 0) {
      return { ok: false, error: 'Oracle rate unavailable' }
    }

    const ringUi = (fiatAmount / ringPerUsd).toFixed(8)
    const ringRaw = nativeTokenUiToRaw(ringUi, getNativeTokenDecimals() ?? 8)
    if (ringRaw <= 0n) {
      return { ok: false, error: 'Converted token amount too small' }
    }

    const wallet = await getNativeWallet(userId, 'solana')
    if (!wallet?.address) {
      return { ok: false, error: 'Solana wallet required for native token onramp' }
    }

    const screen = await screenWalletAddress(wallet.address, userId)
    if (!screen.allowed) {
      return {
        ok: false,
        error: `Compliance rejected: ${'reasonCode' in screen ? screen.reasonCode : 'blocked'}`,
      }
    }

    const transfer = await transferTokenFromTreasury(wallet.address, ringRaw)
    const tokenAmount = nativeTokenRawToUi(ringRaw, getNativeTokenDecimals() ?? 8)

    await createWalletTransaction({
      kind: 'native_token_onramp',
      userId,
      txHash: transfer.txHash,
      fromAddress: transfer.fromAddress,
      toAddress: wallet.address,
      amount: tokenAmount,
      tokenSymbol: getNativeTokenSymbol(),
      chain: 'solana',
      notes: `onramp ${processor} ${orderReference} fiat=${fiatAmount}`,
    })

    logger.info('Native token onramp settled', {
      userId,
      fiatAmount,
      tokenAmount,
      orderReference,
      txHash: transfer.txHash,
      processor,
    })

    try {
      const { appendEvent } = await import('@/lib/events/event-log.server')
      await appendEvent({
        type: 'native_token_onramp_paid',
        userId,
        reversible: false,
        payload: {
          orderReference,
          fiatAmount,
          tokenAmount,
          txHash: transfer.txHash,
          processor,
        },
      })
    } catch {
      // non-blocking
    }

    return { ok: true, txHash: transfer.txHash, tokenAmount }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Onramp settlement failed'
    logger.error('Native token onramp settle failed', {
      userId,
      orderReference,
      error: message,
    })
    return { ok: false, error: message }
  }
}
