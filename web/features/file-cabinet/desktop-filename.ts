import type { FileCabinetDesktopIcon } from '@/features/file-cabinet/types'

/** Visible desktop/tree filename — never RingFileBase object UUID. */
export function visibleIconFilename(
  icon: Pick<FileCabinetDesktopIcon, 'label' | 'meta'>,
  fallback = 'Untitled',
): string {
  const fromMeta = icon.meta?.filename?.trim()
  if (fromMeta) return fromMeta
  const fromLabel = icon.label?.trim()
  if (fromLabel) return fromLabel
  return fallback
}

export function withVisibleFilename(
  icon: FileCabinetDesktopIcon,
  filename: string,
): FileCabinetDesktopIcon {
  const name = filename.trim() || icon.label || 'Untitled'
  return {
    ...icon,
    label: name,
    meta: { ...icon.meta, filename: name },
  }
}

/** Build a new desktop icon from a cabinet node (upload / first sync). */
export function iconFromNode(
  node: { id: string; kind: FileCabinetDesktopIcon['kind']; name: string },
  pos: { x: number; y: number },
): FileCabinetDesktopIcon {
  const filename = node.name.trim() || 'Untitled'
  return {
    id: node.id,
    kind: node.kind,
    label: filename,
    x: pos.x,
    y: pos.y,
    nodeId: node.id,
    meta: { filename },
  }
}
