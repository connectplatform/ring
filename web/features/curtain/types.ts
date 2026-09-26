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
}

export type CurtainAttributionTouch = {
  offerId: string
  productId: string
  authorUserId?: string
  pagePath?: string
  commissionPercent: number
  ctaAt: number
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
  pageKind?: 'news' | 'wiki' | 'profile' | 'other'
}

export type CurtainAdvertiseConfig = {
  enabled: boolean
  commissionPercent: number
}
