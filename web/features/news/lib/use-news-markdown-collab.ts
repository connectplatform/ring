/**
 * News collaboration over Ring Tunnel Yjs — Markdown SSOT (not TipTap Collaboration extension).
 * Channel: collab:news:{articleId}. Requires NEXT_PUBLIC_COLLAB_ENABLED + native WSS.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { useCollaboration } from '@/hooks/use-collaboration'
import {
  isNewsCollabEnabled,
  newsCollabChannel,
  NEWS_COLLAB_YTEXT_KEY,
} from '@/features/news/lib/news-collab-gate'

export type NewsCollabState = {
  enabled: boolean
  connected: boolean
  error: string | null
  /** Push local markdown into the shared Y.Text (no-op when collab off). */
  pushMarkdown: (markdown: string) => void
}

/**
 * Binds article body markdown to Y.Text for multi-author sync.
 * useCollaboration channel uses `collab:${id}` — pass `news:{articleId}`.
 */
export function useNewsMarkdownCollab(
  articleId: string | undefined,
  value: string,
  onRemoteChange: (markdown: string) => void,
): NewsCollabState {
  const enabled = Boolean(articleId) && isNewsCollabEnabled()
  const collabId = articleId ? `news:${articleId}` : ''
  const collab = useCollaboration(collabId)
  const applyingRemote = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !collab.doc) return
    const ytext = collab.doc.getText(NEWS_COLLAB_YTEXT_KEY)

    // Seed empty doc from local tip once
    if (ytext.length === 0 && value) {
      collab.doc.transact(() => {
        ytext.insert(0, value)
      })
    }

    const observer = () => {
      const remote = ytext.toString()
      applyingRemote.current = true
      onRemoteChange(remote)
      queueMicrotask(() => {
        applyingRemote.current = false
      })
    }
    ytext.observe(observer)
    setError(collab.error)
    return () => {
      ytext.unobserve(observer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once per doc
  }, [enabled, collab.doc, collab.error])

  const pushMarkdown = (markdown: string) => {
    if (!enabled || !collab.doc || applyingRemote.current) return
    const ytext = collab.doc.getText(NEWS_COLLAB_YTEXT_KEY)
    const current = ytext.toString()
    if (current === markdown) return
    collab.doc.transact(() => {
      ytext.delete(0, ytext.length)
      if (markdown) ytext.insert(0, markdown)
    })
  }

  return {
    enabled: enabled && collab.enabled,
    connected: collab.connected,
    error: error || collab.error,
    pushMarkdown,
  }
}

/** Channel helper re-export for docs / diagnostics. */
export { newsCollabChannel }
