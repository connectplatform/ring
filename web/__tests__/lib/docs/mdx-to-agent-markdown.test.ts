/**
 * Docs agent Accept negotiation + markdown twin paths + MDX→GFM emitter.
 */
jest.mock('server-only', () => ({}))

import { acceptPrefersMarkdown } from '@/lib/docs/docs-agent-accept'
import { buildDocsMarkdownHref } from '@/lib/docs/docs-path-url'
import { buildAgentMarkdown } from '@/lib/docs/mdx-to-agent-markdown'

describe('acceptPrefersMarkdown', () => {
  it('returns false for empty or browser HTML Accept', () => {
    expect(acceptPrefersMarkdown(null)).toBe(false)
    expect(
      acceptPrefersMarkdown(
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ),
    ).toBe(false)
  })

  it('returns true when only text/markdown is requested', () => {
    expect(acceptPrefersMarkdown('text/markdown')).toBe(true)
  })

  it('returns true when markdown q exceeds html q', () => {
    expect(acceptPrefersMarkdown('text/markdown,text/html;q=0.9')).toBe(true)
    expect(acceptPrefersMarkdown('text/html;q=0.8, text/markdown;q=1')).toBe(true)
  })

  it('returns false when html q is higher or equal', () => {
    expect(acceptPrefersMarkdown('text/html, text/markdown;q=0.5')).toBe(false)
    expect(acceptPrefersMarkdown('text/html;q=1, text/markdown;q=1')).toBe(false)
  })
})

describe('buildDocsMarkdownHref', () => {
  it('appends .md for default locale', () => {
    expect(buildDocsMarkdownHref('en', ['features', 'tunnel-protocol'])).toBe(
      '/docs/features/tunnel-protocol.md',
    )
    expect(buildDocsMarkdownHref('en', [])).toBe('/docs.md')
  })

  it('keeps locale prefix for non-default locales', () => {
    expect(buildDocsMarkdownHref('uk', ['features', 'tunnel-protocol'])).toBe(
      '/uk/docs/features/tunnel-protocol.md',
    )
  })
})

describe('buildAgentMarkdown', () => {
  it('emits GFM with dual-audience sections for tunnel-protocol', () => {
    const r = buildAgentMarkdown('en', ['features', 'tunnel-protocol'])
    expect(r.title).toMatch(/Tunnel/i)
    expect(r.markdown).toContain('For founders')
    expect(r.markdown).toContain('For developers')
    expect(r.markdown).not.toContain('<Audience')
    expect(r.markdown).toContain('```mermaid')
    expect(r.markdownPath).toBe('/docs/features/tunnel-protocol.md')
    expect(r.contentHash).toHaveLength(16)
  })
})
