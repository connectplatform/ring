import { MAX_FOLDER_DEPTH } from '@/features/file-cabinet/constants'

export function normalizeCabinetPath(path: string | undefined | null): string {
  if (!path) return ''
  return path
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('/')
}

export function joinCabinetPath(parentPath: string, name: string): string {
  const base = normalizeCabinetPath(parentPath)
  const segment = name.trim().replace(/[/\\]+/g, '-')
  return base ? `${base}/${segment}` : segment
}

export function cabinetPathDepth(path: string | undefined | null): number {
  const n = normalizeCabinetPath(path)
  if (!n) return 0
  return n.split('/').filter(Boolean).length
}

export function assertFolderDepthOk(path: string): void {
  if (cabinetPathDepth(path) > MAX_FOLDER_DEPTH) {
    throw new Error(`Folders can nest at most ${MAX_FOLDER_DEPTH} levels`)
  }
}
