/**
 * Wiki page folder tree — thin adapter over shared `components/file-tree`.
 * Algorithms absorbed from AI-RINGDOM/ring-file-registry-viewer.
 */
import type { WikiPage } from '@/features/wiki/types'
import {
  buildFileTree,
  buildFolderCounts,
  getActiveFolderPaths,
  rankQuickSearch,
  sortFileTreeNode,
  type QuickMatch,
  type TreeFileBase,
  type TreeNodeBase,
} from '@/components/file-tree/tree-helpers'

export type WikiTreeFile = TreeFileBase & {
  kind: string
}

export type WikiTreeNode = TreeNodeBase<WikiTreeFile>

export function pagesToTreeFiles(pages: WikiPage[]): WikiTreeFile[] {
  return pages.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    path: p.path || '',
    relative_path: p.path ? `${p.path}/${p.slug}` : p.slug,
    kind: p.kind,
  }))
}

export function buildWikiTree(files: WikiTreeFile[]): WikiTreeNode {
  return buildFileTree(files)
}

export function sortWikiTreeNode(node: WikiTreeNode): void {
  sortFileTreeNode(node)
}

export function countPagesByFolder(
  node: WikiTreeNode,
  output: Map<string, number>,
): number {
  let total = node.files.length
  for (const child of Object.values(node.children)) {
    total += countPagesByFolder(child, output)
  }
  if (node.path) output.set(node.path, total)
  return total
}

export function buildWikiFolderCounts(root: WikiTreeNode): Map<string, number> {
  return buildFolderCounts(root)
}

export { getActiveFolderPaths }

export type WikiQuickMatch = QuickMatch<WikiTreeFile>

export function rankWikiQuickSearch(
  files: WikiTreeFile[],
  term: string,
): WikiQuickMatch[] {
  return rankQuickSearch(files, term)
}
