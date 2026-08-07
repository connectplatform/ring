import {
  DOCS_HUB_PATH,
  isDocsNavItemActive,
  normalizeDocsNavPath,
} from '@/lib/docs/docs-nav-active'

describe('docs-nav-active SSOT', () => {
  it('normalizes locale-prefixed paths', () => {
    expect(normalizeDocsNavPath('/uk/docs/features/tunnel-protocol')).toBe(
      '/docs/features/tunnel-protocol',
    )
    expect(normalizeDocsNavPath('/docs')).toBe('/docs')
  })

  it('docs hub is exact-match only', () => {
    expect(isDocsNavItemActive('/docs', DOCS_HUB_PATH)).toBe(true)
    expect(isDocsNavItemActive('/docs/features/tunnel-protocol', DOCS_HUB_PATH)).toBe(false)
  })

  it('highlights leaf and section paths correctly', () => {
    const leaf = '/docs/features/tunnel-protocol'
    expect(isDocsNavItemActive(leaf, leaf)).toBe(true)
    expect(isDocsNavItemActive(leaf, '/docs/features')).toBe(true)
    expect(isDocsNavItemActive(leaf, '/docs/features/opportunities')).toBe(false)
  })

  it('switches active item when navigating to docs index', () => {
    expect(isDocsNavItemActive('/docs', '/docs/features/tunnel-protocol')).toBe(false)
    expect(isDocsNavItemActive('/docs', DOCS_HUB_PATH)).toBe(true)
  })
})
