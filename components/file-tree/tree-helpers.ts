/**
 * Shared folder tree helpers — absorbed from ring-file-registry-viewer /
 * wiki-page-tree (buildTree / sort / folder counts / ranked quick search).
 */

export type TreeFileBase = {
  id: string
  title: string
  /** leaf name / slug for ranking */
  slug: string
  path: string
  relative_path: string
  kind?: string
}

export type TreeNodeBase<T extends TreeFileBase = TreeFileBase> = {
  name: string
  path: string
  children: Record<string, TreeNodeBase<T>>
  files: T[]
}

export function buildFileTree<T extends TreeFileBase>(files: T[]): TreeNodeBase<T> {
  const root: TreeNodeBase<T> = { name: 'root', path: '', children: {}, files: [] }

  for (const file of files) {
    const segments = file.relative_path.split('/')
    let current = root
    let currentPath = ''

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      if (!segment) continue
      if (!current.children[segment]) {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment
        current.children[segment] = {
          name: segment,
          path: currentPath,
          children: {},
          files: [],
        }
      }
      current = current.children[segment]
      currentPath = current.path
    }

    current.files.push(file)
  }

  return root
}

export function sortFileTreeNode<T extends TreeFileBase>(node: TreeNodeBase<T>): void {
  node.files.sort((a, b) => a.relative_path.localeCompare(b.relative_path))
  Object.values(node.children).forEach((child) => sortFileTreeNode(child))
}

function countFilesByFolder<T extends TreeFileBase>(
  node: TreeNodeBase<T>,
  output: Map<string, number>,
): number {
  let total = node.files.length
  for (const child of Object.values(node.children)) {
    total += countFilesByFolder(child, output)
  }
  if (node.path) output.set(node.path, total)
  return total
}

export function buildFolderCounts<T extends TreeFileBase>(
  root: TreeNodeBase<T>,
): Map<string, number> {
  const output = new Map<string, number>()
  countFilesByFolder(root, output)
  return output
}

export function getActiveFolderPaths(relativePath: string): string[] {
  if (!relativePath) return []
  const segments = relativePath.split('/')
  const paths: string[] = []
  let acc = ''
  for (let i = 0; i < segments.length - 1; i++) {
    acc = acc ? `${acc}/${segments[i]}` : segments[i]
    paths.push(acc)
  }
  return paths
}

export type QuickMatch<T extends TreeFileBase = TreeFileBase> = {
  file: T
  rank: number
  folderMatchIndex: number
}

export function rankQuickSearch<T extends TreeFileBase>(
  files: T[],
  term: string,
): QuickMatch<T>[] {
  const quickSearchTerm = term.trim().toLowerCase()
  if (!quickSearchTerm) return []

  return files
    .filter((file) => file.relative_path.toLowerCase().includes(quickSearchTerm))
    .map((file) => {
      const fileNameMatch =
        file.slug.toLowerCase().includes(quickSearchTerm) ||
        file.title.toLowerCase().includes(quickSearchTerm)
      const folderPath = file.path
      const folderMatchIndex = folderPath.toLowerCase().indexOf(quickSearchTerm)
      const folderMatch = folderMatchIndex >= 0
      return {
        file,
        rank: fileNameMatch ? 0 : folderMatch ? 1 : 2,
        folderMatchIndex,
      }
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank
      if (a.rank === 1 && a.folderMatchIndex !== b.folderMatchIndex) {
        return a.folderMatchIndex - b.folderMatchIndex
      }
      const titleCompare = a.file.title.localeCompare(b.file.title)
      if (titleCompare !== 0) return titleCompare
      return a.file.relative_path.localeCompare(b.file.relative_path)
    })
}
