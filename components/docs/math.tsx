'use client'

import 'katex/dist/katex.min.css'
import { BlockMath, InlineMath } from 'react-katex'

export interface MathProps {
  children: string
  display?: boolean
}

export function Math({ children, display = false }: MathProps) {
  const tex = String(children ?? '').trim()
  if (!tex) return null
  if (display) {
    return (
      <div className="my-6 overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 [&_.katex]:text-foreground">
        <BlockMath math={tex} />
      </div>
    )
  }
  return (
    <span className="inline [&_.katex]:text-foreground">
      <InlineMath math={tex} />
    </span>
  )
}

export function MathBlock({ children }: { children: string }) {
  return <Math display>{children}</Math>
}
