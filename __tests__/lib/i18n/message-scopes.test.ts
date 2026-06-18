jest.mock('server-only', () => ({}))
jest.mock('@/lib/seo-metadata', () => ({
  pathnameWithoutLocale: (pathname: string) => {
    const match = pathname.match(/^\/(en|uk|ru)(?=\/|$)/)
    return match ? pathname.slice(match[0].length) || '/' : pathname
  },
}))

import { resolveMessageScope } from '@/lib/i18n/message-scopes'

describe('resolveMessageScope', () => {
  it('maps primary segments after layout unification', () => {
    expect(resolveMessageScope('/store')).toBe('public-store')
    expect(resolveMessageScope('/uk/store')).toBe('public-store')
    expect(resolveMessageScope('/opportunities')).toBe('authenticated')
    expect(resolveMessageScope('/en/opportunities')).toBe('authenticated')
    expect(resolveMessageScope('/admin')).toBe('admin')
    expect(resolveMessageScope('/confidential/entities')).toBe('confidential')
    expect(resolveMessageScope('/docs/roadmap')).toBe('confidential')
    expect(resolveMessageScope('/store/settings')).toBe('authenticated')
    expect(resolveMessageScope('/membership/success')).toBe('authenticated')
    expect(resolveMessageScope('/membership')).toBe('public')
  })
})
