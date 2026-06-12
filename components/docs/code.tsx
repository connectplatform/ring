import React from 'react'
import { CodeBlockShell } from '@/components/docs/code-block-shell'
import { highlightCodeToHtml } from '@/lib/docs/highlight-code'

export interface CodeProps {
  children?: React.ReactNode
  /** Prefer explicit `code` in MDX — children do not cross the RSC→client boundary reliably. */
  code?: string
  language?: string
  title?: string
  showLineNumbers?: boolean
}

function extractCodeText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractCodeText).join('')
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractCodeText(node.props.children)
  }
  return ''
}

/** Server component — single Shiki pass via `highlightCodeToHtml` (no client re-highlight). */
export async function Code({
  children,
  code,
  language = 'typescript',
  title,
}: CodeProps) {
  const source = (code ?? extractCodeText(children)).trimEnd()

  if (!source) {
    return null
  }

  const html = await highlightCodeToHtml(source, language)

  return (
    <CodeBlockShell source={source} html={html} language={language} title={title} />
  )
}
