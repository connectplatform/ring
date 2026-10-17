import { createHmac, timingSafeEqual } from 'crypto'
import { CURTAIN_ATTR_MAX_AGE_SECONDS } from '@/features/curtain/constants'

export type CurtainOfferTokenPayload = {
  offerId: string
  productId: string
  authorUserId: string
  newsArticleId: string
  issuedAt: number
}

const SKEW_MS = 60_000

function signingSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    'ring-curtain-offer-dev'
  )
}

function encode(payload: CurtainOfferTokenPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function signCurtainOffer(payload: CurtainOfferTokenPayload): string {
  const body = encode(payload)
  const sig = createHmac('sha256', signingSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyCurtainOfferToken(token: string, now = Date.now()): CurtainOfferTokenPayload | null {
  const [body, sig] = token.split('.')
  if (!body || !sig || token.split('.').length !== 2) return null
  const expected = createHmac('sha256', signingSecret()).update(body).digest('base64url')
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  let payload: CurtainOfferTokenPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as CurtainOfferTokenPayload
  } catch {
    return null
  }
  if (!payload.offerId || !payload.productId || !payload.authorUserId || !payload.newsArticleId) return null
  if (!Number.isFinite(payload.issuedAt)) return null
  if (payload.issuedAt > now + SKEW_MS) return null
  if (now - payload.issuedAt > CURTAIN_ATTR_MAX_AGE_SECONDS * 1000) return null
  return payload
}
