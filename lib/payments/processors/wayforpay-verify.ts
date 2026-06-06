import crypto from 'crypto'

/** Membership / news hosted-pay webhook (Object.values minus signature) */
export function verifyWayForPayGenericWebhook(payload: Record<string, unknown>): boolean {
  const secret = process.env.WAYFORPAY_SECRET_KEY || process.env.WAYFORPAY_STORE_SECRET_KEY
  if (!secret) return false
  const { merchantSignature, ...data } = payload as { merchantSignature?: string; [k: string]: unknown }
  if (!merchantSignature) return false
  const signatureString = Object.values(data).join(';')
  const expected = crypto.createHmac('md5', secret).update(signatureString).digest('hex')
  return merchantSignature === expected
}

/** Store purchase webhook */
export function verifyWayForPayStoreWebhook(payload: {
  merchantAccount: string
  orderReference: string
  amount: number
  currency: string
  authCode: string
  cardPan: string
  transactionStatus: string
  reasonCode: number
  merchantSignature: string
}): boolean {
  const secret = process.env.WAYFORPAY_STORE_SECRET_KEY || process.env.WAYFORPAY_SECRET_KEY
  if (!secret) return false
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
  const expected = crypto.createHmac('md5', secret).update(parts.join(';'), 'utf8').digest('hex')
  return payload.merchantSignature === expected
}

export function buildMembershipWebhookAck(
  orderReference: string
): { orderReference: string; status: 'accept'; time: number; signature: string } {
  const secretKey = process.env.WAYFORPAY_SECRET_KEY
  if (!secretKey) throw new Error('WAYFORPAY_SECRET_KEY not configured')
  const time = Math.floor(Date.now() / 1000)
  const signatureString = [orderReference, 'accept', time].join(';')
  const signature = crypto.createHmac('md5', secretKey).update(signatureString).digest('hex')
  return { orderReference, status: 'accept', time, signature }
}
