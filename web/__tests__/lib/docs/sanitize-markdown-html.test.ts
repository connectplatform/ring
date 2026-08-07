import { sanitizeMarkdownHtml } from '@/lib/docs/sanitize-markdown-html'

describe('sanitizeMarkdownHtml', () => {
  it('strips script and event handlers', () => {
    const dirty =
      '<p onclick="alert(1)">Hi</p><script>alert(2)</script><a href="javascript:alert(3)">x</a>'
    const clean = sanitizeMarkdownHtml(dirty)
    expect(clean).not.toContain('script')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('javascript:')
    expect(clean).toContain('<p>')
    expect(clean).toContain('Hi')
  })

  it('keeps tables and safe links', () => {
    const html =
      '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table><a href="/docs">Docs</a>'
    const clean = sanitizeMarkdownHtml(html)
    expect(clean).toContain('<table>')
    expect(clean).toContain('<th>')
    expect(clean).toContain('href="/docs"')
    expect(clean).toContain('rel="noopener noreferrer"')
  })

  it('rejects iframe embeds', () => {
    const dirty = '<p>ok</p><iframe src="https://evil.test"></iframe>'
    const clean = sanitizeMarkdownHtml(dirty)
    expect(clean).toContain('<p>')
    expect(clean).not.toContain('iframe')
  })

  it('strips style attributes', () => {
    const dirty = '<p style="color:red">Hi</p><span style="--x:1">x</span>'
    const clean = sanitizeMarkdownHtml(dirty)
    expect(clean).not.toContain('style=')
    expect(clean).toContain('Hi')
  })
})
