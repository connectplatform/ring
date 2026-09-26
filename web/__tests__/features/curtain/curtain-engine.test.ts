import {
  applyNotForMe,
  applyNotToday,
  canShowOffer,
  impressionsUsedToday,
  recordImpression,
} from '@/features/curtain/lib/frequency'
import { CURTAIN_MAX_IMPRESSIONS_PER_DAY, CURTAIN_NOT_TODAY_MS, CURTAIN_ATTR_MAX_TOUCHES } from '@/features/curtain/constants'
import {
  parseCurtainAttributionJson,
  mergeCurtainTouch,
  compactCurtainTouches,
} from '@/features/curtain/lib/attribution-storage'
import { isEligibleCurtain, pathMayHavePageAuthor, shouldHideProductAd, shouldSkipCurtainPath } from '@/features/curtain/lib/eligibility'
import { commissionPercentForMint } from '@/features/curtain/lib/advertise'
import { galleryFromProductDoc, primaryGalleryUrl } from '@/features/generative-media/types'

describe('curtain frequency', () => {
  const now = Date.parse('2026-09-10T12:00:00.000Z')

  it('suppresses forever after not-for-me', () => {
    const pref = applyNotForMe({})
    expect(canShowOffer(pref, now)).toBe(false)
  })

  it('suppresses 24h after not-today then resurfaces', () => {
    const pref = applyNotToday({}, now)
    expect(canShowOffer(pref, now + 1000)).toBe(false)
    expect(canShowOffer(pref, now + CURTAIN_NOT_TODAY_MS + 1)).toBe(true)
  })

  it('caps impressions per UTC day', () => {
    let pref = recordImpression({}, now)
    for (let i = 1; i < CURTAIN_MAX_IMPRESSIONS_PER_DAY; i++) {
      pref = recordImpression(pref, now)
    }
    expect(impressionsUsedToday(pref, now)).toBe(CURTAIN_MAX_IMPRESSIONS_PER_DAY)
    expect(canShowOffer(pref, now)).toBe(false)
    expect(canShowOffer(pref, now + 24 * 60 * 60 * 1000)).toBe(true)
  })
})

describe('curtain attribution window', () => {
  it('keeps 30-day touches and drops older', () => {
    const fresh = Date.now() - 2 * 24 * 60 * 60 * 1000
    const stale = Date.now() - 40 * 24 * 60 * 60 * 1000
    const parsed = parseCurtainAttributionJson(
      JSON.stringify([
        { offerId: 'product:a', productId: 'a', commissionPercent: 5, ctaAt: fresh, authorUserId: 'author-1' },
        { offerId: 'product:b', productId: 'b', commissionPercent: 5, ctaAt: stale, authorUserId: 'author-1' },
      ]),
    )
    expect(parsed.map((row) => row.productId)).toEqual(['a'])
  })

  it('replaces prior touch for the same product', () => {
    const first = {
      offerId: 'product:a',
      productId: 'a',
      commissionPercent: 3,
      ctaAt: Date.now() - 1000,
      authorUserId: 'old',
    }
    const next = {
      offerId: 'product:a',
      productId: 'a',
      commissionPercent: 8,
      ctaAt: Date.now(),
      authorUserId: 'new',
    }
    const merged = mergeCurtainTouch([first], next)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.authorUserId).toBe('new')
    expect(merged[0]?.commissionPercent).toBe(8)
  })

  it('keeps stamped checkout touches even if the 30-day window has since elapsed', () => {
    const stale = Date.now() - 40 * 24 * 60 * 60 * 1000
    const parsed = parseCurtainAttributionJson(
      JSON.stringify([
        { offerId: 'product:a', productId: 'a', commissionPercent: 5, ctaAt: stale, authorUserId: 'author-1' },
      ]),
      { applyWindow: false },
    )
    expect(parsed.map((row) => row.productId)).toEqual(['a'])
  })

  it('parses URL-encoded cookie payloads', () => {
    const fresh = Date.now() - 1000
    const encoded = encodeURIComponent(
      JSON.stringify([
        { offerId: 'product:a', productId: 'a', commissionPercent: 5, ctaAt: fresh, authorUserId: 'author-1' },
      ]),
    )
    expect(parseCurtainAttributionJson(encoded)[0]?.productId).toBe('a')
  })

  it('caps stored touches so the attribution cookie cannot exceed a short recency list', () => {
    const now = Date.now()
    const many = Array.from({ length: 20 }, (_, i) => ({
      offerId: `product:${i}`,
      productId: `p${i}`,
      commissionPercent: 5,
      ctaAt: now - i * 1000,
    }))
    expect(compactCurtainTouches(many)).toHaveLength(CURTAIN_ATTR_MAX_TOUCHES)
  })
})

describe('curtain commission mint percent', () => {
  it('skips a 0% touch instead of clamping it up to 1%', () => {
    expect(commissionPercentForMint(0)).toBeNull()
    expect(commissionPercentForMint(5)).toBe(5)
  })
})

describe('curtain route skip', () => {
  it('hides the curtain on admin, auth, vendor, and checkout chrome', () => {
    expect(shouldSkipCurtainPath('/uk/admin/store')).toBe(true)
    expect(shouldSkipCurtainPath('/login')).toBe(true)
    expect(shouldSkipCurtainPath('/en/store/checkout')).toBe(true)
    expect(shouldSkipCurtainPath('/vendor/products')).toBe(true)
    expect(shouldSkipCurtainPath('/uk/news/hello')).toBe(false)
  })
})

describe('curtain author-page gate', () => {
  it('waits for page author on news articles and username slugs', () => {
    expect(pathMayHavePageAuthor('/uk/news/hello')).toBe(true)
    expect(pathMayHavePageAuthor('/news/categories')).toBe(false)
    expect(pathMayHavePageAuthor('/uk/alice/my-post')).toBe(true)
    expect(pathMayHavePageAuthor('/uk/store/sku-1')).toBe(false)
  })
})

describe('curtain eligibility', () => {
  it('hides A2HS in standalone display', () => {
    expect(isEligibleCurtain('a2hs', { isStandalone: true })).toBe(false)
    expect(isEligibleCurtain('a2hs', { isStandalone: false })).toBe(true)
  })

  it('hides product ads without price or for the vendor own SKU; shows to guests', () => {
    expect(shouldHideProductAd({ hasPrice: false, isVendorsOwnProduct: false })).toBe(true)
    expect(shouldHideProductAd({ hasPrice: true, isVendorsOwnProduct: true })).toBe(true)
    expect(shouldHideProductAd({ hasPrice: true, isVendorsOwnProduct: false })).toBe(false)
  })
})

describe('product gallery hydrate', () => {
  it('uses webp/derivatives when originalUrl is empty so Save can enable', () => {
    const gallery = galleryFromProductDoc({
      generativeGallery: {
        items: [
          {
            id: '1',
            originalUrl: '',
            webpUrl: 'https://cdn.example/p.webp',
            contentType: 'image/webp',
            source: 'upload',
            enabled: true,
            isPrimary: true,
          },
        ],
      },
    })
    expect(primaryGalleryUrl(gallery)).toContain('cdn.example')
  })

  it('falls back to nested images[] objects from imports', () => {
    const gallery = galleryFromProductDoc({
      data: { images: [{ url: 'https://cdn.example/imported.jpg' }] },
    })
    expect(primaryGalleryUrl(gallery)).toBe('https://cdn.example/imported.jpg')
  })
})
