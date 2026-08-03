/** Typed JSONB metadata bags for opportunity specializations (stored under `metadata`). */

import { getCollectiveOrderDefaultRails, getMainCurrencySymbol } from '@/lib/ring-config-core'
import type { CollectiveOrderConfigRail } from '@/lib/ring-config-types'

export type CollectiveOrderEscrowStatus =
  | 'open'
  | 'funded'
  | 'fulfilled'
  | 'cancelled'
  | 'refunding'

export type CollectiveOrderRail = CollectiveOrderConfigRail

export interface CollectiveOrderMetadata {
  productTitle?: string
  productSku?: string
  productImages?: string[]
  productQty?: number
  productUnit?: string
  slotCount: number
  slotPrice: number
  slotsFilled: number
  currency: string
  rails: CollectiveOrderRail[]
  escrowStatus: CollectiveOrderEscrowStatus
  escrowPoolId?: string
  allowMultiSlot?: boolean
}

export interface ScheduledServicesAvailabilityWindow {
  start: string
  end: string
  timezone: string
}

export interface ScheduledServicesMetadata {
  serviceCategory?: string
  durationMinutes?: number
  capacityPerSlot?: number
  pricePerSlot?: number
  currencyType?: 'credit_balance' | 'main_currency'
  availability?: ScheduledServicesAvailabilityWindow[]
  bookingMode?: 'interest' | 'hold'
}

export interface BountyMetadata {
  prizeAmount?: number
  currencyType?: string
  acceptanceCriteria?: string
  maxWinners?: number
  submissionDeadline?: string
}

export interface TenderMetadata {
  budgetCap?: number
  responseDeadline?: string
  evaluationNotes?: string
  allowAnonymousBids?: boolean
}

export interface AssetRentalMetadata {
  assetKind?: string
  unitsAvailable?: number
  pricePerPeriod?: number
  periodUnit?: 'hour' | 'day' | 'week'
  depositOptional?: boolean
}

export interface JobMetadata {
  employmentType?: 'full_time' | 'part_time' | 'contract'
  salaryMin?: number
  salaryMax?: number
  remotePolicy?: string
}

export type OpportunityTypeMetadata =
  | CollectiveOrderMetadata
  | ScheduledServicesMetadata
  | BountyMetadata
  | TenderMetadata
  | AssetRentalMetadata
  | JobMetadata

export function asCollectiveOrderMetadata(
  raw: unknown,
): CollectiveOrderMetadata | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Partial<CollectiveOrderMetadata>
  if (typeof m.slotCount !== 'number' || typeof m.slotPrice !== 'number') return null
  return {
    productTitle: m.productTitle,
    productSku: m.productSku,
    productImages: Array.isArray(m.productImages) ? m.productImages : undefined,
    productQty: m.productQty,
    productUnit: m.productUnit,
    slotCount: m.slotCount,
    slotPrice: m.slotPrice,
    slotsFilled: typeof m.slotsFilled === 'number' ? m.slotsFilled : 0,
    currency: m.currency || getMainCurrencySymbol(),
    rails:
      Array.isArray(m.rails) && m.rails.length > 0 ? m.rails : getCollectiveOrderDefaultRails(),
    escrowStatus: m.escrowStatus || 'open',
    escrowPoolId: m.escrowPoolId,
    allowMultiSlot: Boolean(m.allowMultiSlot),
  }
}

export function asScheduledServicesMetadata(
  raw: unknown,
): ScheduledServicesMetadata | null {
  if (!raw || typeof raw !== 'object') return null
  return raw as ScheduledServicesMetadata
}
