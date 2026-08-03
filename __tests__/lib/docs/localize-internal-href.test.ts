import { localizeInternalHref } from '@/lib/docs/localize-internal-href'

describe('localizeInternalHref', () => {
  it('leaves paths alone for default locale', () => {
    expect(localizeInternalHref('/docs/features/x', 'en')).toBe('/docs/features/x')
  })

  it('prefixes non-default locale', () => {
    expect(localizeInternalHref('/docs/features/x', 'uk')).toBe('/uk/docs/features/x')
  })

  it('does not double-prefix', () => {
    expect(localizeInternalHref('/uk/docs/features/x', 'uk')).toBe('/uk/docs/features/x')
  })

  it('leaves external URLs alone', () => {
    expect(localizeInternalHref('https://example.com/a', 'uk')).toBe('https://example.com/a')
  })
})
