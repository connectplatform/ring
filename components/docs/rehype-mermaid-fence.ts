/**
 * Rehype: turn ```mermaid fenced blocks into MDX `<Mermaid>` flow elements *before* Shiki runs,
 * so diagram source is not tokenized as a random language.
 */
import { visit } from 'unist-util-visit'

function hastPlainText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as { type?: string; value?: unknown; children?: unknown[] }
  if (n.type === 'text' && typeof n.value === 'string') return n.value
  if (Array.isArray(n.children)) return n.children.map(hastPlainText).join('')
  return ''
}

function codeIsMermaid(code: { type?: string; tagName?: string; properties?: { className?: unknown } }): boolean {
  if (code.type !== 'element' || code.tagName !== 'code') return false
  const cls = code.properties?.className
  const list = Array.isArray(cls) ? cls : cls != null ? [cls] : []
  return list.some((c) => String(c).includes('language-mermaid'))
}

/**
 * Must run **before** `@shikijs/rehype` in `rehypePlugins`.
 */
export function rehypeMermaidFenceToMdx() {
  return (tree: unknown) => {
    visit(tree as any, 'element', (node: any, index: number | undefined, parent: any) => {
      if (node?.tagName !== 'pre' || parent == null || typeof index !== 'number') return
      const code = node.children?.find(
        (c: any) => c?.type === 'element' && c.tagName === 'code' && codeIsMermaid(c),
      )
      if (!code) return
      const source = hastPlainText(code).replace(/\n+$/, '')
      const jsx: any = {
        type: 'mdxJsxFlowElement',
        name: 'Mermaid',
        attributes: [],
        children: [{ type: 'text', value: `\n${source}\n` }],
      }
      parent.children[index] = jsx
    })
    return tree
  }
}
