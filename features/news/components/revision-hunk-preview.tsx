'use client'

import {
  buildDiffLines,
  groupDiffLines,
  htmlToDiffText,
  type DiffLine,
} from '@/features/news/lib/revision-diff'
import { cn } from '@/lib/utils'

type RevisionHunkPreviewProps = {
  baseContent: string
  proposedContent: string
  className?: string
  emptyLabel?: string
}

function LineRow({ line }: { line: DiffLine }) {
  return (
    <div
      className={cn(
        'flex gap-2 rounded-sm px-2 py-0.5 font-mono text-xs leading-relaxed',
        line.kind === 'add' && 'bg-[#e8f4ec]',
        line.kind === 'remove' && 'bg-[#f5ecec]',
        line.kind === 'equal' && 'bg-transparent text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'w-4 shrink-0 select-none text-center font-semibold',
          line.kind === 'add' && 'text-green-700',
          line.kind === 'remove' && 'text-red-700',
        )}
      >
        {line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ' '}
      </span>
      <span
        className={cn(
          'flex-1 whitespace-pre-wrap break-words',
          line.kind === 'remove' && 'text-red-900/80 line-through opacity-85',
          line.kind === 'add' && 'text-green-900',
        )}
      >
        {line.text || ' '}
      </span>
    </div>
  )
}

/**
 * Hunk preview — pale green adds, pale red crossed-out deletes (file-registry-viewer pattern).
 */
export function RevisionHunkPreview({
  baseContent,
  proposedContent,
  className,
  emptyLabel = 'No textual differences detected.',
}: RevisionHunkPreviewProps) {
  const lines = buildDiffLines(htmlToDiffText(baseContent), htmlToDiffText(proposedContent))
  const hunks = groupDiffLines(lines)

  if (!lines.length) {
    return (
      <p className="text-sm text-muted-foreground">{emptyLabel}</p>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {hunks.map((hunk) => (
        <div
          key={hunk.id}
          className={cn(
            'overflow-hidden rounded-lg border p-2',
            hunk.hasAdd && hunk.hasRemove && 'border-amber-300/60 bg-amber-50/40',
            hunk.hasAdd && !hunk.hasRemove && 'border-green-200/80',
            hunk.hasRemove && !hunk.hasAdd && 'border-red-200/80',
          )}
        >
          {hunk.lines.map((line) => (
            <LineRow key={line.id} line={line} />
          ))}
        </div>
      ))}
    </div>
  )
}
