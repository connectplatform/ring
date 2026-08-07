/** Shared WayForPay HPP constants/types (safe for client + server). */

export const WAYFORPAY_HPP_URL = 'https://secure.wayforpay.com/pay'

/** Flat or multi-value fields for HPP form POST (productName[] etc.). */
export type WayForPayHppFields = Record<string, string | string[]>
