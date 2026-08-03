export interface RefcodeRecord {
  code: string
  ownerUserId: string
  walletAddress: string
  active: boolean
  createdAt: string
  visits?: number
  /** Daily visit buckets (UTC YYYY-MM-DD → count), retained ~28 days. */
  visitDaily?: Record<string, number>
  lastVisitAt?: string
  visitStats?: {
    total: number
    today: number
    last7d: number
    last28d: number
  }
}

/** Value triad shared by task budgets, referral rewards and escrow. */
export type { ValueDenomination } from '@/lib/value-denomination'
import type { ValueDenomination } from '@/lib/value-denomination'

/** Rail the paid order settled on — determines auto-approve vs pending_approval. */
export type ReferralRewardRail = ValueDenomination

export type ReferralRewardStatus =
  | 'pending_approval'
  | 'approved'
  | 'minting'
  | 'minted'
  | 'failed'
  | 'rejected'

export interface ReferralRewardRecord {
  orderReference: string
  orderId: string
  refCode: string
  referrerUserId: string
  referrerWallet: string
  refereeUserId: string
  orderAmount: number
  currencyType: ValueDenomination
  currencyCode?: string
  displayUnit: ValueDenomination
  rewardToken: string
  rewardAmount: string
  rewardAmountWei: string
  /** Effective weighted referral % used for this reward (cross-rail with ERP settlement). */
  rewardPercent?: number
  chainId: number
  rail: ReferralRewardRail
  status: ReferralRewardStatus
  txHash?: string
  approvedBy?: string
  approvedAt?: string
  failureReason?: string
  createdAt: string
  updatedAt?: string
}

export interface OrderReferralAttribution {
  referralCode?: string
  referrerUserId?: string
  referrerWallet?: string
}

export interface ResolvedRefcode {
  code: string
  ownerUserId: string
  walletAddress: string
}
