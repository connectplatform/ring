/**
 * Persist TipTap selection (and optional scroll) — same localStorage+version
 * spirit as cursor-feed pagination (`ring-feed-*`), scoped to one editor key.
 *
 * Feed cursors page lists; this stores ProseMirror `{ from, to }` so reopening
 * the CV / wiki modal restores caret + scrolls it into view.
 */
export type EditorSelectionMemory = {
  v: 1
  from: number
  to: number
  scrollTop?: number
  updatedAt: number
}

const TTL_MS = 24 * 60 * 60 * 1000

export function editorSelectionStorageKey(scope: string): string {
  return `ring-editor-sel-${scope}`
}

export function readEditorSelection(scope: string): EditorSelectionMemory | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(editorSelectionStorageKey(scope))
    if (!raw) return null
    const parsed = JSON.parse(raw) as EditorSelectionMemory
    if (parsed?.v !== 1 || typeof parsed.from !== 'number') return null
    if (Date.now() - (parsed.updatedAt || 0) > TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function writeEditorSelection(
  scope: string,
  sel: Omit<EditorSelectionMemory, 'v' | 'updatedAt'>,
): void {
  if (typeof window === 'undefined') return
  try {
    const payload: EditorSelectionMemory = {
      v: 1,
      from: sel.from,
      to: sel.to,
      scrollTop: sel.scrollTop,
      updatedAt: Date.now(),
    }
    window.localStorage.setItem(
      editorSelectionStorageKey(scope),
      JSON.stringify(payload),
    )
  } catch {
    /* quota / private mode */
  }
}
