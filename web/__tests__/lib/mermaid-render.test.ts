import { normalizeMermaidSource } from '@/lib/mermaid-render'

describe('normalizeMermaidSource', () => {
  it('replaces br tags inside mindmap root circles', () => {
    const input = `mindmap
  root((Ring Platform<br/>20+ Features))
    Core Intelligence`

    const out = normalizeMermaidSource(input)
    expect(out).toContain('root((Ring Platform — 20+ Features))')
    expect(out).not.toContain('<br/>')
  })

  it('leaves flowchart sources unchanged', () => {
    const input = `graph LR
    A --> B`
    expect(normalizeMermaidSource(input)).toBe(input)
  })
})
