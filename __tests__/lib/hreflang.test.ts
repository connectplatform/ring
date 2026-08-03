import {
  generateHreflangAlternates,
  stripHreflangLinkHeaderValue,
  toAbsoluteHreflangMap,
  withLocalePath,
} from '@/lib/hreflang'

describe('hreflang SSOT', () => {
  it('omits locale prefix for default locale and prefixes others', () => {
    expect(withLocalePath('en', '/about')).toBe('/about')
    expect(withLocalePath('uk', '/about')).toBe('/uk/about')
    expect(withLocalePath('uk', '/')).toBe('/uk')
  })

  it('includes x-default matching default locale path', () => {
    const map = generateHreflangAlternates('/news')
    expect(map.en).toBe('/news')
    expect(map.uk).toBe('/uk/news')
    expect(map['x-default']).toBe('/news')
  })

  it('builds absolute URLs with a single origin and as-needed paths', () => {
    const abs = toAbsoluteHreflangMap('/docs')
    for (const href of Object.values(abs)) {
      expect(href.startsWith('http')).toBe(true)
      expect(href.includes('://')).toBe(true)
    }
    expect(abs.en).toMatch(/\/docs$/)
    expect(abs.uk).toMatch(/\/uk\/docs$/)
    expect(abs.en).not.toMatch(/\/en\/docs/)
  })

  it('strips hreflang Link header entries and keeps others', () => {
    const input =
      '</foo>; rel="preload", </en>; rel="alternate"; hreflang="en", </uk>; rel="alternate"; hreflang="uk"'
    expect(stripHreflangLinkHeaderValue(input)).toBe('</foo>; rel="preload"')
    expect(stripHreflangLinkHeaderValue('</en>; rel="alternate"; hreflang="en"')).toBeNull()
    expect(stripHreflangLinkHeaderValue(null)).toBeNull()
  })
})
