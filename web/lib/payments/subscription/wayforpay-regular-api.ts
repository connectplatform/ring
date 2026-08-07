/**
 * WayForPay Regular API wrapper — recurring payment lifecycle.
 *
 * SSOT: All `regularApi` operations (STATUS, CHANGE, SUSPEND, RESUME, REMOVE)
 * use **merchantAccount + merchantPassword** (NOT secretKey) and POST JSON to
 * https://api.wayforpay.com/regularApi per WayForPay Guru truth lens.
 *
 * Initial recurring setup happens on the Purchase endpoint (see wayforpay-service.ts
 * `initiatePayment`) by passing `regularMode`, `dateNext`, `regularOn:1`.
 *
 * @see AI-LEGIOX/legiox-truth-lens/payments-wayforpay-guru.json
 */

import 'server-only'

import crypto from 'crypto'
import { logger } from '@/lib/logger'

const WAYFORPAY_REGULAR_API_URL = 'https://api.wayforpay.com/regularApi'

// ---------------------------------------------------------------------------
// Auth — per truth lens: regularApi uses merchantAccount + merchantPassword
// ---------------------------------------------------------------------------

function getRegularApiCredentials(): { account: string; password: string } | null {
  const account = process.env.WAYFORPAY_MERCHANT_ACCOUNT
  // Merchant dashboard password — NOT the secretKey used for Purchase API
  const password = process.env.WAYFORPAY_MERCHANT_PASSWORD
  if (!account || !password) return null
  return { account, password }
}

// ---------------------------------------------------------------------------
// Signature — HMAC-MD5 over semicolon-delimited param values
// ---------------------------------------------------------------------------

/**
 * Generate HMAC-MD5 signature for a regularApi request.
 * String template: values joined by ';' (per truth lens RECURRING_MGMT pattern).
 */
function generateRegularSignature(values: (string | number)[]): string {
  const password = process.env.WAYFORPAY_MERCHANT_PASSWORD
  if (!password) throw new Error('WAYFORPAY_MERCHANT_PASSWORD not configured')
  const str = values.join(';')
  return crypto.createHmac('md5', password).update(str, 'utf8').digest('hex')
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RegularRequestType = 'STATUS' | 'CHANGE' | 'SUSPEND' | 'RESUME' | 'REMOVE'

export type RegularMode =
  | 'once'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'halfyearly'
  | 'yearly'
  | 'client'

export type RegularStatus =
  | 'Active'
  | 'Suspended'
  | 'Created'
  | 'Removed'
  | 'Confirmed'
  | 'Completed'

export interface RegularStatusResult {
  success: boolean
  status?: RegularStatus
  mode?: RegularMode
  amount?: number
  currency?: string
  email?: string
  dateBegin?: string
  dateEnd?: string
  lastPayedDate?: string
  lastPayedStatus?: string
  nextPaymentDate?: string
  error?: string
}

export interface RegularChangeInput {
  orderReference: string
  regularMode: RegularMode
  amount: number
  currency: string
  /** DD.MM.YYYY format */
  dateBegin: string
  /** DD.MM.YYYY format */
  dateEnd: string
}

export interface RegularSimpleResult {
  success: boolean
  orderReference?: string
  status?: RegularStatus
  error?: string
}

// ---------------------------------------------------------------------------
// API operations
// ---------------------------------------------------------------------------

/**
 * STATUS — query current state and schedule of a recurring payment.
 */
export async function getRecurringStatus(
  orderReference: string,
): Promise<RegularStatusResult> {
  return callRegularApi<RegularStatusResult>('STATUS', {
    orderReference,
    mapResponse: (resp) => ({
      success: true,
      status: (resp.status as RegularStatus) ?? undefined,
      mode: (resp.mode as RegularMode) ?? undefined,
      amount: typeof resp.amount === 'number' ? resp.amount : Number(resp.amount ?? 0) || undefined,
      currency: resp.currency as string | undefined,
      email: resp.email as string | undefined,
      dateBegin: resp.dateBegin as string | undefined,
      dateEnd: resp.dateEnd as string | undefined,
      lastPayedDate: resp.lastPayedDate as string | undefined,
      lastPayedStatus: resp.lastPayedStatus as string | undefined,
      nextPaymentDate: resp.nextPaymentDate as string | undefined,
    }),
  })
}

/**
 * CHANGE — modify amount, frequency, or date window of an existing recurring payment.
 */
export async function changeRecurringPayment(
  input: RegularChangeInput,
): Promise<RegularSimpleResult> {
  return callRegularApi<RegularSimpleResult>('CHANGE', {
    orderReference: input.orderReference,
    extraFields: {
      regularMode: input.regularMode,
      amount: input.amount,
      currency: input.currency,
      dateBegin: input.dateBegin,
      dateEnd: input.dateEnd,
    },
    mapResponse: (resp) => ({
      success: resp.status === 'Confirmed' || resp.status === 'Active',
      orderReference: input.orderReference,
      status: (resp.status as RegularStatus) ?? undefined,
    }),
  })
}

/**
 * SUSPEND — pause a recurring payment.
 */
export async function suspendRecurringPayment(
  orderReference: string,
): Promise<RegularSimpleResult> {
  return callRegularApi<RegularSimpleResult>('SUSPEND', {
    orderReference,
    mapResponse: (resp) => ({
      success: resp.status === 'Suspended',
      orderReference,
      status: (resp.status as RegularStatus) ?? undefined,
    }),
  })
}

/**
 * RESUME — unpause a previously suspended recurring payment.
 */
export async function resumeRecurringPayment(
  orderReference: string,
): Promise<RegularSimpleResult> {
  return callRegularApi<RegularSimpleResult>('RESUME', {
    orderReference,
    mapResponse: (resp) => ({
      success: resp.status === 'Active',
      orderReference,
      status: (resp.status as RegularStatus) ?? undefined,
    }),
  })
}

/**
 * REMOVE — cancel a recurring payment permanently.
 */
export async function removeRecurringPayment(
  orderReference: string,
): Promise<RegularSimpleResult> {
  return callRegularApi<RegularSimpleResult>('REMOVE', {
    orderReference,
    mapResponse: (resp) => ({
      success: resp.status === 'Removed',
      orderReference,
      status: (resp.status as RegularStatus) ?? undefined,
    }),
  })
}

// ---------------------------------------------------------------------------
// Internal — typed POST wrapper
// ---------------------------------------------------------------------------

interface CallArgs<T> {
  orderReference: string
  extraFields?: Record<string, string | number>
  mapResponse: (resp: Record<string, unknown>) => T
}

async function callRegularApi<T>(
  requestType: RegularRequestType,
  args: CallArgs<T>,
): Promise<T> {
  const creds = getRegularApiCredentials()
  if (!creds) {
    return { success: false, error: 'WayForPay regular API not configured (missing WAYFORPAY_MERCHANT_PASSWORD)' } as T
  }

  // Build the field map for signature — order: merchantAccount, orderReference, then extra fields
  const fieldMap: Record<string, string | number> = {
    merchantAccount: creds.account,
    orderReference: args.orderReference,
    ...(args.extraFields ?? {}),
  }
  // Signature is computed over values in the SAME order as fields
  const signatureValues: (string | number)[] = [
    fieldMap.merchantAccount,
    fieldMap.orderReference,
    ...Object.entries(args.extraFields ?? {}).map(([_, v]) => v),
  ]

  try {
    const signature = generateRegularSignature(signatureValues)

    const response = await fetch(WAYFORPAY_REGULAR_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'json' },
      body: JSON.stringify({
        requestType,
        ...fieldMap,
        merchantPassword: creds.password,
        merchantSignature: signature,
      }),
    })

    if (!response.ok) {
      throw new Error(`WayForPay regularApi error: ${response.status} ${response.statusText}`)
    }

    const resp = (await response.json()) as Record<string, unknown>

    // WayForPay returns reason='Ok' on success
    if (resp.reason && resp.reason !== 'Ok') {
      logger.warn('WayForPay regularApi non-Ok reason', {
        requestType,
        orderReference: args.orderReference,
        reason: resp.reason,
        reasonCode: resp.reasonCode,
      })
      return { success: false, error: `WayForPay: ${resp.reason}` } as T
    }

    return args.mapResponse(resp)
  } catch (error) {
    logger.error('WayForPay regularApi call failed', {
      requestType,
      orderReference: args.orderReference,
      error: error instanceof Error ? error.message : error,
    })
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' } as T
  }
}
