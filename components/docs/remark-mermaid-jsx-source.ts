/**
 * Remark: normalize `<Mermaid>` / `<MindMap>` JSX children for `next-mdx-remote/rsc`.
 *
 * MDX authors often write:
 *   <Mermaid title="…">{`flowchart TB …`}</Mermaid>
 *
 * `@mdx-js/mdx` compiles that to a template-literal expression child, but RSC + client
 * components lose expression `children` at runtime (`children` becomes `undefined`).
 * Plain text children and ```mermaid fences work; expression children do not.
 *
 * This plugin rewrites expression children into literal `text` nodes so diagram source
 * survives MDXRemote serialization.
 */
import { visit } from 'unist-util-visit'

const DIAGRAM_TAGS = new Set(['Mermaid', 'MindMap'])

type MdxExpression = {
  type: 'mdxFlowExpression' | 'mdxTextExpression'
  value?: string
  data?: {
    estree?: {
      body?: Array<{
        expression?: {
          type?: string
          value?: unknown
          quasis?: Array<{ value?: { cooked?: string; raw?: string } }>
        }
      }>
    }
  }
}

function expressionToSource(node: MdxExpression): string {
  const expression = node.data?.estree?.body?.[0]?.expression
  if (expression?.type === 'TemplateLiteral') {
    const parts = expression.quasis ?? []
    return parts.map((q) => q.value?.cooked ?? q.value?.raw ?? '').join('')
  }
  if (expression?.type === 'Literal' && typeof expression.value === 'string') {
    return expression.value
  }

  const raw = node.value?.trim() ?? ''
  if (raw.startsWith('`') && raw.endsWith('`')) {
    return raw.slice(1, -1).replace(/\\n/g, '\n').replace(/\\`/g, '`')
  }
  return raw
}

function mdastToPlainText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as { type?: string; value?: string; children?: unknown[] }
  if (n.type === 'text' && typeof n.value === 'string') return n.value
  if (Array.isArray(n.children)) return n.children.map(mdastToPlainText).join('')
  return ''
}

export function remarkMermaidJsxSource() {
  return (tree: unknown) => {
    visit(tree as any, 'mdxJsxFlowElement', (node: any) => {
      if (!DIAGRAM_TAGS.has(node.name)) return
      if (!Array.isArray(node.children) || node.children.length === 0) return

      const normalized: Array<{ type: 'text'; value: string }> = []
      for (const child of node.children) {
        if (child.type === 'mdxFlowExpression' || child.type === 'mdxTextExpression') {
          const value = expressionToSource(child as MdxExpression)
          if (value.trim()) normalized.push({ type: 'text', value })
          continue
        }
        const value = mdastToPlainText(child).trim()
        if (value) normalized.push({ type: 'text', value })
      }

      node.children = normalized
    })
    return tree
  }
}
