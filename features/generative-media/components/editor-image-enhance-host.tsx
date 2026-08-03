'use client'

/**
 * TipTap Image click → FileCabinetImageViewer → Enhance/Enlive gen modal.
 * Registers MediaUseTarget so Use replaces selected image attrs or inserts at cursor.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { FileCabinetImageViewer } from '@/features/file-cabinet/components/file-cabinet-image-viewer'
import { GenerativeMediaEditorFsModal } from '@/features/generative-media/components/generative-media-editor-fs-modal'
import { useMediaUseTarget, type MediaUsePayload } from '@/features/generative-media/media-use-target'
import {
  CABINET_ENHANCE_PROMPT,
  CABINET_ENLIVE_PROMPT,
} from '@/features/generative-media/types'

export function EditorImageEnhanceHost({
  editor,
  surfaceId,
}: {
  editor: Editor | null
  surfaceId: string
}) {
  const id = useId()
  const targetId = `${surfaceId}:${id}`
  const { register, unregister } = useMediaUseTarget()
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)
  const [genOpen, setGenOpen] = useState(false)
  const [genMode, setGenMode] = useState<'image' | 'video'>('image')
  const [genPrompt, setGenPrompt] = useState('')
  const [genFieldId, setGenFieldId] = useState<'enhance' | 'enlive'>('enhance')
  const replacePosRef = useRef<number | null>(null)

  useEffect(() => {
    if (!editor) return

    const replace = (payload: MediaUsePayload) => {
      if (payload.kind === 'video') {
        editor
          .chain()
          .focus()
          .setVideo({
            src: payload.url,
            fileId: payload.fileId,
          })
          .run()
        return
      }
      const src = payload.webpUrl || payload.url
      const pos = replacePosRef.current
      if (pos != null) {
        editor
          .chain()
          .focus()
          .setNodeSelection(pos)
          .updateAttributes('image', { src, alt: payload.alt || '' })
          .run()
        return
      }
      const { from } = editor.state.selection
      const node = editor.state.doc.nodeAt(from)
      if (node?.type.name === 'image') {
        editor.chain().focus().updateAttributes('image', { src, alt: payload.alt || '' }).run()
        return
      }
      editor.chain().focus().setImage({ src, alt: payload.alt || '' }).run()
    }

    register({ id: targetId, replace })
    return () => unregister(targetId)
  }, [editor, register, unregister, targetId])

  useEffect(() => {
    if (!editor) return

    const onClick = (event: Event) => {
      const target = event.target as HTMLElement | null
      if (!target || target.tagName !== 'IMG') return
      if (!target.closest('.ProseMirror')) return
      const img = target as HTMLImageElement
      const src = img.getAttribute('src') || img.src
      if (!src) return
      event.preventDefault()
      event.stopPropagation()

      let pos: number | null = null
      editor.state.doc.descendants((node, p) => {
        if (node.type.name === 'image' && node.attrs.src === src) {
          pos = p
          return false
        }
        return true
      })
      replacePosRef.current = pos
      setViewerSrc(src)
      setViewerOpen(true)
    }

    const dom = editor.view.dom
    dom.addEventListener('click', onClick)
    return () => dom.removeEventListener('click', onClick)
  }, [editor])

  const openEnhance = useCallback(() => {
    if (!viewerSrc) return
    setViewerOpen(false)
    setGenFieldId('enhance')
    setGenMode('image')
    setGenPrompt(CABINET_ENHANCE_PROMPT)
    setGenOpen(true)
  }, [viewerSrc])

  const openEnlive = useCallback(() => {
    if (!viewerSrc) return
    setViewerOpen(false)
    setGenFieldId('enlive')
    setGenMode('video')
    setGenPrompt(CABINET_ENLIVE_PROMPT)
    setGenOpen(true)
  }, [viewerSrc])

  return (
    <>
      <FileCabinetImageViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        src={viewerSrc || undefined}
        showDownload={false}
        onEnhance={openEnhance}
        onEnlive={openEnlive}
      />
      <GenerativeMediaEditorFsModal
        open={genOpen}
        onOpenChange={setGenOpen}
        scope="editor"
        pageSlug={surfaceId}
        fieldId={genFieldId}
        purpose={`editor-${genFieldId}`}
        initialMode={genMode}
        initialPrompt={genPrompt}
        referenceImageUrl={viewerSrc || undefined}
      />
    </>
  )
}
