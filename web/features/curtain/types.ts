export type CurtainKind = 'a2hs' | 'product'

export type CurtainCtaAction = 'a2hs' | 'add_to_cart' | 'link'

export type CurtainResponseType =
  | 'cta'
  | 'not_today'
  | 'not_for_me'
  | 'scroll_away'
  | 'replaced'

export type CurtainTextLine = {
  text: string
  className?: string
}

export type CurtainDropParams = {
  offerId: string
  kind: CurtainKind
  mediaUrl?: string
  line1: CurtainTextLine
  line2?: CurtainTextLine
  ctaText: string
  ctaHref?: string
  ctaAction: CurtainCtaAction
  ctaStyle?: string
  bgStyle?: string
  heightVh?: number
  productId?: string
  productName?: string
  productPrice?: number
  productCurrency?: string
  authorUserId?: string
  pagePath?: string
  commissionPercent?: number
  /** HMAC from the server. Checkout ignores product touches without it. */
  offerToken?: string
  newsArticleId?: string
  vendorId?: string
  fromPage?: boolean
}

export type CurtainAttributionTouch = {
  offerId: string
  productId: string
  authorUserId?: string
  pagePath?: string
  commissionPercent: number
  ctaAt: number
  offerToken?: string
  newsArticleId?: string
  vendorId?: string
}

export type CurtainOfferPref = {
  suppress?: 'forever' | 'until'
  until?: number
  impressionsToday?: number
  impressionDay?: string
}

export type CurtainPrefsDoc = {
  offers: Record<string, CurtainOfferPref>
  updatedAt: string
}

export type CurtainPageContextValue = {
  authorUserId?: string
  newsArticleId?: string
  pageKind?: 'news' | 'wiki' | 'profile' | 'other'
}

export type CurtainProductSource = 'page_then_pool' | 'page_only' | 'pool_only'

export type CurtainPolicy = {
  enabled: boolean
  productSource: CurtainProductSource
  maxImpressionsPerDay: number
  notTodayHours: number
}

export type CurtainFunnelCounts = {
  shown: number
  resurfaced: number
  cta: number
  notToday: number
  notForMe: number
  scrollAway: number
  paid: number
}

export type CurtainAdvertiseConfig = {
  enabled: boolean
  commissionPercent: number
}
