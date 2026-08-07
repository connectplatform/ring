import 'server-only'

import { createPublicClient, http, keccak256, toBytes } from 'viem'
import { polygon } from 'viem/chains'
import referralRewardsAbi from '@/features/refcodes/abi/referral-rewards.json'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import {
  getReferralChain,
  getReferralMinterWalletClient,
  getReferralRpcUrl,
  isReferralMinterConfigured,
} from '@/lib/web3/server-wallet'
import { REFERRAL_REWARDS_COLLECTION } from '@/features/refcodes/constants'
import type { ReferralRewardRecord } from '@/features/refcodes/types'
import { getReferralRewardTokenSymbol, REFERRAL_REWARDS_ADDRESS } from '@/constants/web3'
import { DEFAULT_LOCALE } from '@/lib/locale-config'
import {
  getReferralMintNotificationCopy,
  getUserPreferredLocaleForNotifications,
} from '@/lib/i18n/refcodes-labels'
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import {
  getCreditUnitToMainCurrencyRate,
  getMainCurrencyCreditAccountingRate,
} from '@/lib/ring-oracle'

function orderRefBytes32(orderReference: string): `0x${string}` {
  return keccak256(toBytes(orderReference))
}

function prefersCreditPayout(reward: ReferralRewardRecord): boolean {
  if (reward.rail === 'credit_balance') return true
  if (!isReferralMinterConfigured()) return true
  if (reward.referrerWallet?.startsWith('username:')) return true
  return false
}

async function payReferralAsCredits(
  rewardId: string,
  reward: ReferralRewardRecord,
): Promise<{ success: boolean; error?: string }> {
  const unitPerMain = getCreditUnitToMainCurrencyRate()
  const percent = typeof reward.rewardPercent === 'number' ? reward.rewardPercent : 5
  const mainReward =
    typeof reward.orderAmount === 'number' && reward.orderAmount > 0
      ? (reward.orderAmount * percent) / 100
      : parseFloat(reward.rewardAmount || '0')
  const creditAmount = Math.max(0, mainReward / (unitPerMain > 0 ? unitPerMain : 0.1))
  const amountStr = creditAmount.toFixed(2)

  if (creditAmount <= 0) {
    return { success: false, error: 'Zero credit reward' }
  }

  await db().updateDoc(REFERRAL_REWARDS_COLLECTION, rewardId, {
    status: 'minting',
    updatedAt: new Date().toISOString(),
  })

  try {
    const rate = getMainCurrencyCreditAccountingRate()
    await creditBalanceService.addCredits(
      reward.referrerUserId,
      {
        amount: amountStr,
        description: `Referral assisted sale (${reward.refCode})`,
        reference_id: `referral_reward:${rewardId}`,
        metadata: {
          rewardId,
          orderReference: reward.orderReference,
          refCode: reward.refCode,
          rail: reward.rail,
        },
      },
      'bonus',
      rate,
    )

    await db().updateDoc(REFERRAL_REWARDS_COLLECTION, rewardId, {
      status: 'minted',
      rewardAmount: amountStr,
      displayUnit: 'credit_balance',
      updatedAt: new Date().toISOString(),
    })

    try {
      const { createNotification } = await import(
        '@/features/notifications/services/notification-service'
      )
      const { NotificationType, NotificationPriority } = await import(
        '@/features/notifications/types'
      )
      const locale =
        (await getUserPreferredLocaleForNotifications(reward.referrerUserId)) ??
        DEFAULT_LOCALE
      const copy = await getReferralMintNotificationCopy(locale, {
        amount: amountStr,
        token: 'credits',
      })
      await createNotification({
        userId: reward.referrerUserId,
        type: NotificationType.REFERRAL_REWARD_MINTED,
        priority: NotificationPriority.NORMAL,
        title: copy.title,
        body: copy.body,
        data: {
          amount: amountStr,
          metadata: {
            rewardId,
            orderReference: reward.orderReference,
            payout: 'credit_balance',
          },
        },
      })
    } catch (notifyError) {
      logger.warn('Referral credit notification skipped', { rewardId, notifyError })
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Credit payout failed'
    logger.error('Referral credit payout failed', { rewardId, error })
    await db().updateDoc(REFERRAL_REWARDS_COLLECTION, rewardId, {
      status: 'failed',
      failureReason: message,
      updatedAt: new Date().toISOString(),
    })
    return { success: false, error: message }
  }
}

export async function mintReferralReward(rewardId: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const read = await db().findDocById<ReferralRewardRecord & { id: string }>(
    REFERRAL_REWARDS_COLLECTION,
    rewardId
  )
  if (!read.success || !read.data) {
    return { success: false, error: 'Reward record not found' }
  }

  const reward = read.data
  if (reward.status === 'minted' && (reward.txHash || reward.displayUnit === 'credit_balance')) {
    return { success: true, txHash: reward.txHash }
  }
  if (reward.status !== 'approved' && reward.status !== 'failed') {
    return { success: false, error: `Invalid reward status: ${reward.status}` }
  }

  if (prefersCreditPayout(reward)) {
    return payReferralAsCredits(rewardId, reward)
  }

  const walletClient = getReferralMinterWalletClient()
  const contractAddress = REFERRAL_REWARDS_ADDRESS as `0x${string}`
  if (!walletClient || !contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
    return { success: false, error: 'Referral rewards contract not configured' }
  }

  await db().updateDoc(REFERRAL_REWARDS_COLLECTION, rewardId, {
    status: 'minting',
    updatedAt: new Date().toISOString(),
  })

  const amount = BigInt(reward.rewardAmountWei)
  const orderRef = orderRefBytes32(reward.orderReference)
  const refWallet = reward.referrerWallet as `0x${string}`

  try {
    const chain = getReferralChain()
    const publicClient = createPublicClient({
      chain: chain.id === 137 ? polygon : chain,
      transport: http(getReferralRpcUrl()),
    })

    const { request } = await publicClient.simulateContract({
      address: contractAddress,
      abi: referralRewardsAbi,
      functionName: 'payReferral',
      args: [refWallet, amount, orderRef],
      account: walletClient.account!,
    })

    const hash = await walletClient.writeContract(request)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    if (receipt.status !== 'success') {
      throw new Error('Transaction reverted')
    }

    await db().updateDoc(REFERRAL_REWARDS_COLLECTION, rewardId, {
      status: 'minted',
      txHash: hash,
      updatedAt: new Date().toISOString(),
    })

    try {
      const { createNotification } = await import('@/features/notifications/services/notification-service')
      const { NotificationType, NotificationPriority } = await import('@/features/notifications/types')
      const locale =
        (await getUserPreferredLocaleForNotifications(reward.referrerUserId)) ?? DEFAULT_LOCALE
      const copy = await getReferralMintNotificationCopy(locale, {
        amount: reward.rewardAmount,
        token: getReferralRewardTokenSymbol(),
      })
      await createNotification({
        userId: reward.referrerUserId,
        type: NotificationType.REFERRAL_REWARD_MINTED,
        priority: NotificationPriority.NORMAL,
        title: copy.title,
        body: copy.body,
        data: {
          transactionHash: hash,
          amount: reward.rewardAmount,
          metadata: {
            rewardId,
            orderReference: reward.orderReference,
          },
        },
      })
    } catch (notifyError) {
      logger.warn('Referral mint notification skipped', { rewardId, notifyError })
    }

    return { success: true, txHash: hash }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mint failed'
    logger.error('Referral reward mint failed', { rewardId, error })
    await db().updateDoc(REFERRAL_REWARDS_COLLECTION, rewardId, {
      status: 'failed',
      failureReason: message,
      updatedAt: new Date().toISOString(),
    })
    return { success: false, error: message }
  }
}

export async function processApprovedRewards(limit = 10): Promise<{ processed: number; succeeded: number }> {
  const result = await db().queryDocs<ReferralRewardRecord & { id: string }>({
    collection: REFERRAL_REWARDS_COLLECTION,
    filters: [{ field: 'status', operator: '=', value: 'approved' }],
    pagination: { limit },
  })

  const rows = result.success ? result.data : []
  let succeeded = 0

  for (const row of rows) {
    const minted = await mintReferralReward(row.id)
    if (minted.success) succeeded++
  }

  return { processed: rows.length, succeeded }
}
