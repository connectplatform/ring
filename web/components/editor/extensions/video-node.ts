/**
 * Shared TipTap Video atom — native <video> for news + scientific editors.
 */

import { Node, mergeAttributes } from '@tiptap/core'

export type VideoAttrs = {
  src: string
  poster?: string | null
  fileId?: string | null
  controls?: boolean
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ringVideo: {
      setVideo: (attrs: { src: string; poster?: string; fileId?: string }) => ReturnType
    }
  }
}

export const VideoExtension = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      poster: { default: null },
      fileId: { default: null },
      controls: { default: true },
    }
  },

  parseHTML() {
    return [{ tag: 'video[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const src = String(HTMLAttributes.src || '')
    const poster = HTMLAttributes.poster ? String(HTMLAttributes.poster) : undefined
    const fileId = HTMLAttributes.fileId ? String(HTMLAttributes.fileId) : undefined
    const controls = HTMLAttributes.controls !== false && HTMLAttributes.controls !== 'false'

    return [
      'video',
      mergeAttributes({
        src,
        poster,
        controls: controls ? 'true' : undefined,
        playsinline: 'true',
        preload: 'metadata',
        'data-file-id': fileId || undefined,
        class: 'ring-video',
      }),
    ]
  },

  addCommands() {
    return {
      setVideo:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              src: attrs.src,
              poster: attrs.poster ?? null,
              fileId: attrs.fileId ?? null,
              controls: true,
            },
          }),
    }
  },
})
