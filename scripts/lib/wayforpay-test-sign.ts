import crypto from 'crypto'

/** Build a WayForPay generic-webhook payload with a valid HMAC-MD5 merchantSignature. */
export function signGenericWayForPayPayload(
  payload: Record<string, unknown>,
  secret: string,
): Record<string, unknown> {
  const signatureString = Object.values(payload).join(';')
  const merchantSignature = crypto.createHmac('md5', secret).update(signatureString).digest('hex')
  return { ...payload, merchantSignature }
}

/** Store purchase webhook — matches verifyWayForPayStoreWebhook / verifyStoreWebhookSignature. */
export function signStoreWayForPayPayload(
  payload: {
    merchantAccount: string
    orderReference: string
    amount: number
    currency: string
    authCode: string
    cardPan: string
    transactionStatus: string
    reasonCode: number
  },
  secret: string,
): Record<string, unknown> {
  const parts = [
    payload.merchantAccount,
    payload.orderReference,
    payload.amount.toString(),
    payload.currency,
    payload.authCode,
    payload.cardPan,
    payload.transactionStatus,
    payload.reasonCode.toString(),
  ]
  const merchantSignature = crypto.createHmac('md5', secret).update(parts.join(';'), 'utf8').digest('hex')
  return { ...payload, merchantSignature }
}
