import type { CurtainDropParams } from '@/features/curtain/types'

type Payload = Record<string, unknown>

const pending: Array<{ event: string; data: Payload }> = []

export function curtainEventPayload(offer: CurtainDropParams, extra?: Payload): Payload {
  return {
    offerId: offer.offerId,
    kind: offer.kind,
    productId: offer.productId,
    authorUserId: offer.authorUserId,
    vendorId: offer.vendorId,
    newsArticleId: offer.newsArticleId,
    pagePath: offer.pagePath,
    fromPage: offer.fromPage,
    ...extra,
  }
}

function tracker(): { track: (event: string, data?: Payload) => void } | null {
  if (typeof window === 'undefined') return null
  const api = window.ringAnalytics
  return api?.track ? api : null
}

export function trackCurtain(event: string, data: Payload): void {
  const api = tracker()
  if (!api) {
    pending.push({ event, data })
    return
  }
  while (pending.length > 0) {
    const row = pending.shift()
    if (row) api.track(row.event, row.data)
  }
  api.track(event, data)
}
