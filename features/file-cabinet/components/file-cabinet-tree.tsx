'use client'

import { useMemo } from 'react'
import { Folder } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FileCabinetDesktopIcon, FileCabinetNode } from '@/features/file-cabinet/types'
import { visibleIconFilename } from '@/features/file-cabinet/desktop-filename'

type Props = {
  /** All folders (nested) for the current scope. */
  folders: FileCabinetNode[]
  icons?: FileCabinetDesktopIcon[]
  selectedId: string | null
  /** Current workspace folder (center pane). */
  workspaceFolderId: string | null
  expandedIds: string[]
  onToggleExpand: (folderId: string) => void
  onSelect: (nodeId: string) => void
  onOpenFolder: (nodeId: string | null) => void
  className?: string
}

type TreeRow = {
  node: FileCabinetNode
  depth: number
  hasChildren: boolean
}

function buildVisibleRows(
  folders: FileCabinetNode[],
  expanded: Set<string>,
): TreeRow[] {
  const byParent = new Map<string | null, FileCabinetNode[]>()
  const folderIds = new Set(folders.map((f) => f.id))
  for (const f of folders) {
    const key = f.parentId || null
    const list = byParent.get(key) || []
    list.push(f)
    byParent.set(key, list)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name))
  }

  const rows: TreeRow[] = []
  const walk = (parentId: string | null, depth: number) => {
    const kids = byParent.get(parentId) || []
    for (const node of kids) {
      const hasChildren = (byParent.get(node.id) || []).length > 0
      rows.push({ node, depth, hasChildren })
      if (hasChildren && expanded.has(node.id)) {
        walk(node.id, depth + 1)
      }
    }
  }
  walk(null, 0)

  const placed = new Set(rows.map((r) => r.node.id))
  const orphans = folders
    .filter((f) => {
      if (placed.has(f.id)) return false
      if (f.parentId == null) return true
      return !folderIds.has(f.parentId)
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  for (const node of orphans) {
    const hasChildren = (byParent.get(node.id) || []).length > 0
    rows.push({ node, depth: 0, hasChildren })
    if (hasChildren && expanded.has(node.id)) {
      walk(node.id, 1)
    }
  }

  return rows
}

function ExpandGlyph({ expanded }: { expanded: boolean }) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center border border-foreground/60 bg-background text-sm font-bold leading-none text-foreground"
      aria-hidden
    >
      {expanded ? '−' : '+'}
    </span>
  )
}

/**
 * Folders-only expandable tree.
 * Active/selected dir: fully-rounded (99px) boundary + active background.
 */
export function FileCabinetTree({
  folders,
  icons,
  selectedId,
  workspaceFolderId,
  expandedIds,
  onToggleExpand,
  onSelect,
  onOpenFolder,
  className,
}: Props) {
  const expanded = useMemo(() => new Set(expandedIds), [expandedIds])
  const rows = useMemo(() => buildVisibleRows(folders, expanded), [folders, expanded])

  const labelFor = (n: FileCabinetNode) => {
    const icon = icons?.find((i) => i.nodeId === n.id)
    return icon ? visibleIconFilename(icon, n.name) : n.name
  }

  return (
    <div
      className={cn(
        'relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-visible border border-border/50 border-r-0',
        'rounded-l-md',
        className,
      )}
    >
      <div className="relative min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-visible px-1 py-2 pr-1">
        {rows.map(({ node, depth, hasChildren }) => {
          const selected = selectedId === node.id || workspaceFolderId === node.id
          const isExpanded = expanded.has(node.id)
          return (
            <div
              key={node.id}
              className={cn(
                'group relative flex w-full items-center gap-1.5 py-1.5 pr-2 text-left text-sm transition-colors',
                !selected && 'rounded-md hover:bg-accent/60',
                selected &&
                  cn(
                    'z-30 overflow-visible font-medium',
                    'rounded-[99px]',
                    'bg-[color-mix(in_oklch,var(--davinci-surface-bg)_92%,hsl(var(--accent)))]',
                    'ring-1 ring-inset ring-[color-mix(in_oklch,var(--davinci-beam)_32%,transparent)]',
                    'shadow-[-12px_0_20px_-14px_rgba(0,0,0,0.28)]',
                  ),
              )}
              style={{ paddingLeft: 10 + depth * 14 }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className="relative z-[1] shrink-0 rounded-sm hover:bg-accent"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleExpand(node.id)
                  }}
                >
                  <ExpandGlyph expanded={isExpanded} />
                </button>
              ) : (
                <span className="relative z-[1] inline-block h-5 w-5 shrink-0" aria-hidden />
              )}
              <button
                type="button"
                className="relative z-[1] flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                onClick={() => {
                  onSelect(node.id)
                  onOpenFolder(node.id)
                }}
              >
                <Folder className="h-5 w-5 shrink-0 text-primary" />
                <span className={cn(selected ? 'whitespace-nowrap pr-1' : 'truncate')}>
                  {labelFor(node)}
                </span>
              </button>
            </div>
          )
        })}

        {folders.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">—</p>
        ) : null}
      </div>
    </div>
  )
}
