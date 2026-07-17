/**
 * WayForPay Hosted Payment Page (HPP) server helpers.
 * HPP endpoint requires HTML form POST — never GET query strings.
 * Returns conductor-owned CheckoutRedirect (form_post).
 *
 * @see payments-wayforpay-guru — PURCHASE_HPP
 */
import crypto from 'crypto'
import {
  WAYFORPAY_HPP_URL,
  type WayForPayHppFields,
} from '@/lib/payments/wayforpay-hpp-types'
import type { CheckoutRedirect } from '@/lib/payments/conductor/types'
import { formPostCheckoutRedirect } from '@/lib/payments/conductor/types'

export { WAYFORPAY_HPP_URL, type WayForPayHppFields }

export function signWayForPayPurchaseString(signString: string, secret: string): string {
  return crypto.createHmac('md5', secret).update(signString).digest('hex')
}

/**
 * Build purchase signature string:
 * merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;
 * productName[0];…;productCount[0];…;productPrice[0];…
 */
export function buildWayForPayPurchaseSignString(opts: {
  merchantAccount: string
  merchantDomainName: string
  orderReference: string
  orderDate: number
  amount: number
  currency: string
  productNames: string[]
  productCounts: number[]
  productPrices: number[]
}): string {
  return [
    opts.merchantAccount,
    opts.merchantDomainName,
    opts.orderReference,
    opts.orderDate,
    opts.amount,
    opts.currency,
    ...opts.productNames,
    ...opts.productCounts,
    ...opts.productPrices,
  ].join(';')
}

/** Single-line item wallet/news/onramp HPP → conductor redirect DTO. */
export function buildWayForPaySimpleHppFields(opts: {
  merchant: string
  secret: string
  domain: string
  orderReference: string
  orderDate: number
  amount: number
  currency: string
  productName: string
  returnUrl: string
  serviceUrl: string
  clientEmail?: string
  language?: string
}): {
  redirect: CheckoutRedirect
  /** @deprecated mirrored for normalizeCheckoutResult / legacy APIs */
  paymentUrl: string
  paymentFields: WayForPayHppFields
} {
  const productNames = [opts.productName]
  const productCounts = [1]
  const productPrices = [opts.amount]
  const signString = buildWayForPayPurchaseSignString({
    merchantAccount: opts.merchant,
    merchantDomainName: opts.domain,
    orderReference: opts.orderReference,
    orderDate: opts.orderDate,
    amount: opts.amount,
    currency: opts.currency,
    productNames,
    productCounts,
    productPrices,
  })
  const merchantSignature = signWayForPayPurchaseString(signString, opts.secret)

  const paymentFields: WayForPayHppFields = {
    merchantAccount: opts.merchant,
    merchantDomainName: opts.domain,
    merchantTransactionSecureType: 'AUTO',
    orderReference: opts.orderReference,
    orderDate: String(opts.orderDate),
    amount: String(opts.amount),
    currency: opts.currency,
    'productName[]': productNames,
    'productCount[]': productCounts.map(String),
    'productPrice[]': productPrices.map(String),
    merchantSignature,
    returnUrl: opts.returnUrl,
    serviceUrl: opts.serviceUrl,
  }
  if (opts.clientEmail) paymentFields.clientEmail = opts.clientEmail
  if (opts.language) paymentFields.language = opts.language

  const redirect = formPostCheckoutRedirect(WAYFORPAY_HPP_URL, paymentFields)
  return { redirect, paymentUrl: redirect.url, paymentFields }
}
