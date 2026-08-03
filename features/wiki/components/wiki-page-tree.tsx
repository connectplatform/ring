'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Folder } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WikiPage } from '@/features/wiki/types'
import {
  buildWikiFolderCounts,
  buildWikiTree,
  getActiveFolderPaths,
  pagesToTreeFiles,
  rankWikiQuickSearch,
  sortWikiTreeNode,
  type WikiTreeFile,
  type WikiTreeNode,
} from '@/features/wiki/wiki-page-tree'

type Props = {
  pages: WikiPage[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Optional filter term (aside search); when set, show ranked flat matches */
  filterTerm?: string
  className?: string
}

function TreeBranch({
  node,
  depth,
  expanded,
  toggle,
  selectedId,
  onSelect,
  folderCounts,
}: {
  node: WikiTreeNode
  depth: number
  expanded: Set<string>
  toggle: (path: string) => void
  selectedId: string | null
  onSelect: (id: string) => void
  folderCounts: Map<string, number>
}) {
  const childFolders = Object.values(node.children).sort((a, b) =>
    a.name.localeCompare(b.name),
  )

  return (
    <ul className={cn(depth === 0 ? 'space-y-0.5' : 'space-y-0')}>
      {childFolders.map((child) => {
        const isOpen = expanded.has(child.path)
        const count = folderCounts.get(child.path) ?? 0
        return (
          <li key={child.path}>
            <button
              type="button"
              className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-sm hover:bg-muted"
              style={{ paddingLeft: `${depth * 12 + 4}px` }}
              onClick={() => toggle(child.path)}
            >
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
              )}
              <Folder className="h-3.5 w-3.5 shrink-0 text-amber-600/80 dark:text-amber-400/80" />
              <span className="min-w-0 flex-1 truncate font-medium">{child.name}</span>
              <span className="text-[10px] text-muted-foreground">{count}</span>
            </button>
            {isOpen ? (
              <TreeBranch
                node={child}
                depth={depth + 1}
                expanded={expanded}
                toggle={toggle}
                selectedId={selectedId}
                onSelect={onSelect}
                folderCounts={folderCounts}
              />
            ) : null}
          </li>
        )
      })}
      {node.files.map((file) => (
        <li key={file.id}>
          <PageRow
            file={file}
            depth={depth}
            selected={file.id === selectedId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  )
}

function PageRow({
  file,
  depth,
  selected,
  onSelect,
}: {
  file: WikiTreeFile
  depth: number
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-sm',
        selected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
      )}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
      onClick={() => onSelect(file.id)}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 opacity-80" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{file.title}</span>
        <span
          className={cn(
            'block truncate text-[11px]',
            selected ? 'opacity-80' : 'opacity-60',
          )}
        >
          {file.relative_path}
        </span>
      </span>
    </button>
  )
}

export function WikiPageTree({
  pages,
  selectedId,
  onSelect,
  filterTerm = '',
  className,
}: Props) {
  const treeFiles = useMemo(() => pagesToTreeFiles(pages), [pages])

  const treeRoot = useMemo(() => {
    const root = buildWikiTree(treeFiles)
    sortWikiTreeNode(root)
    return root
  }, [treeFiles])

  const folderCounts = useMemo(
    () => buildWikiFolderCounts(treeRoot),
    [treeRoot],
  )

  const selectedRelative = useMemo(() => {
    const hit = treeFiles.find((f) => f.id === selectedId)
    return hit?.relative_path || ''
  }, [treeFiles, selectedId])

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(['']),
  )

  // Expand top-level folders on first load (registry-viewer pattern)
  useEffect(() => {
    if (filterTerm.trim()) return
    if (!treeFiles.length) return
    if (!(expandedFolders.size === 1 && expandedFolders.has(''))) return

    const next = new Set<string>([''])
    for (const file of treeFiles) {
      const firstSlash = file.relative_path.indexOf('/')
      if (firstSlash > 0) {
        next.add(file.relative_path.slice(0, firstSlash))
      }
    }
    if (next.size > 1) setExpandedFolders(next)
  }, [filterTerm, treeFiles, expandedFolders])

  // Keep selected page's ancestor folders open
  useEffect(() => {
    const active = getActiveFolderPaths(selectedRelative)
    if (!active.length) return
    setExpandedFolders((previous) => {
      const next = new Set(previous)
      active.forEach((p) => next.add(p))
      return next.size === previous.size ? previous : next
    })
  }, [selectedRelative])

  const toggle = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const quickMatches = useMemo(
    () => rankWikiQuickSearch(treeFiles, filterTerm),
    [treeFiles, filterTerm],
  )

  if (filterTerm.trim()) {
    return (
      <div className={cn('max-h-[40vh] overflow-y-auto', className)}>
        {quickMatches.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">No matches</p>
        ) : (
          <ul className="space-y-0.5">
            {quickMatches.map(({ file }) => (
              <li key={file.id}>
                <PageRow
                  file={file}
                  depth={0}
                  selected={file.id === selectedId}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className={cn('max-h-[40vh] overflow-y-auto', className)}>
      <TreeBranch
        node={treeRoot}
        depth={0}
        expanded={expandedFolders}
        toggle={toggle}
        selectedId={selectedId}
        onSelect={onSelect}
        folderCounts={folderCounts}
      />
    </div>
  )
}
