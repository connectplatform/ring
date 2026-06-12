/**
 * Rehype: turn ```lang fenced blocks into MDX `<Code language="…">` flow elements.
 * Runs after `rehypeMermaidFenceToMdx` so diagrams are excluded. Replaces `@shikijs/rehype`
 * — highlighting happens once in the async `Code` server component via `highlightCodeToHtml`.
 */
import { visit } from 'unist-util-visit'

function hastPlainText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as { type?: string; value?: unknown; children?: unknown[] }
  if (n.type === 'text' && typeof n.value === 'string') return n.value
  if (Array.isArray(n.children)) return n.children.map(hastPlainText).join('')
  return ''
}

function fenceLanguage(code: {
  type?: string
  tagName?: string
  properties?: { className?: unknown }
}): string | null {
  if (code.type !== 'element' || code.tagName !== 'code') return null
  const cls = code.properties?.className
  const list = Array.isArray(cls) ? cls : cls != null ? [cls] : []
  const langClass = list.find((c) => String(c).startsWith('language-'))
  if (!langClass) return 'text'
  return String(langClass).replace('language-', '')
}

function isDiagramLanguage(lang: string): boolean {
  return lang === 'mermaid' || lang === 'mindmap'
}

export function rehypeCodeFenceToMdx() {
  return (tree: unknown) => {
    visit(tree as Parameters<typeof visit>[0], 'element', (node: any, index, parent) => {
      if (node?.tagName !== 'pre' || parent == null || typeof index !== 'number') return

      const code = node.children?.find((c: any) => c?.type === 'element' && c.tagName === 'code')
      if (!code) return

      const lang = fenceLanguage(code) ?? 'text'
      if (isDiagramLanguage(lang)) return

      const source = hastPlainText(code).replace(/\n+$/, '')
      if (!source) return

      const jsx: any = {
        type: 'mdxJsxFlowElement',
        name: 'Code',
        attributes: [
          {
            type: 'mdxJsxAttribute',
            name: 'language',
            value: lang,
          },
        ],
        children: [{ type: 'text', value: `\n${source}\n` }],
      }
      parent.children[index] = jsx
    })
    return tree
  }
}
