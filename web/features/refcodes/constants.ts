export const REF_COOKIE_NAME = 'ring_ref'
/** Client-readable mirror for checkout UI (non-httpOnly). */
export const REF_VISIBLE_COOKIE_NAME = 'ring_ref_visible'
export const REF_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export const REFCODE_COLLECTION = 'refcodes'
export const REFERRAL_REWARDS_COLLECTION = 'referral_rewards'

export const REFERRAL_REWARD_PERCENT = Number(process.env.REFERRAL_REWARD_PERCENT || '5')
export const REFERRAL_CHAIN_ID = Number(process.env.REFERRAL_CHAIN_ID || '137')
export const REFERRAL_UAH_PER_USD = Number(process.env.REFERRAL_UAH_PER_USD || '40')
