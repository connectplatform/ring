'use client'

import 'katex/dist/katex.min.css'
import { BlockMath, InlineMath } from 'react-katex'
import { DiagramViewer } from '@/components/docs/diagram-viewer'

export interface MathProps {
  children: string
  display?: boolean
}

export function Math({ children, display = false }: MathProps) {
  const tex = String(children ?? '').trim()
  if (!tex) return null
  if (display) {
    return (
      <DiagramViewer
        diagramLabel="Formula"
        copyText={tex}
        copyLabel="Copy"
        compact
        className="[&_.katex]:text-foreground"
      >
        <div className="w-full min-w-0 overflow-x-auto px-2 py-4 text-center">
          <BlockMath math={tex} />
        </div>
      </DiagramViewer>
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
