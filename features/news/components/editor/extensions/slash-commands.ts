/**
 * Notion-style slash command item helpers for TipTap NewsEditor.
 */

import type { Editor, Range } from '@tiptap/core'
import {
  detectEmbedFromUrl,
  looksLikeLoneUrl,
} from '@/features/news/lib/editor-widget-detector'

export type SlashCommandItem = {
  title: string
  description: string
  group: 'basic' | 'media' | 'insert'
  command: (props: { editor: Editor; range: Range }) => void
}

export function buildSlashItems(handlers: {
  onRequestImageUpload?: () => void
  onRequestGenerateImage?: () => void
  onRequestEmbedUrl?: () => void
}): SlashCommandItem[] {
  return [
    {
      title: 'Heading 1',
      description: 'Large section heading',
      group: 'basic',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run()
      },
    },
    {
      title: 'Heading 2',
      description: 'Medium section heading',
      group: 'basic',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run()
      },
    },
    {
      title: 'Heading 3',
      description: 'Small section heading',
      group: 'basic',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run()
      },
    },
    {
      title: 'Bullet list',
      description: 'Unordered list',
      group: 'basic',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run()
      },
    },
    {
      title: 'Numbered list',
      description: 'Ordered list',
      group: 'basic',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run()
      },
    },
    {
      title: 'Quote',
      description: 'Block quote',
      group: 'basic',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run()
      },
    },
    {
      title: 'Code block',
      description: 'Monospace code',
      group: 'basic',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
      },
    },
    {
      title: 'Divider',
      description: 'Horizontal rule',
      group: 'basic',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run()
      },
    },
    {
      title: 'Image',
      description: 'Upload an image',
      group: 'media',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run()
        handlers.onRequestImageUpload?.()
      },
    },
    {
      title: 'Generate image',
      description: 'AI-generated image',
      group: 'media',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run()
        handlers.onRequestGenerateImage?.()
      },
    },
    {
      title: 'Embed',
      description: 'YouTube, Rumble, X, Facebook, Suno, or link card',
      group: 'media',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run()
        handlers.onRequestEmbedUrl?.()
      },
    },
    {
      title: 'Link',
      description: 'Insert a hyperlink',
      group: 'insert',
      command: ({ editor, range }) => {
        const url = window.prompt('Link URL')
        if (!url) {
          editor.chain().focus().deleteRange(range).run()
          return
        }
        editor.chain().focus().deleteRange(range).setLink({ href: url }).run()
      },
    },
  ]
}

/** Insert embed from a lone pasted URL. */
export function tryInsertEmbedFromPaste(editor: Editor, text: string): boolean {
  if (!looksLikeLoneUrl(text)) return false
  const detected = detectEmbedFromUrl(text.trim())
  editor
    .chain()
    .focus()
    .insertRingEmbed({
      provider: detected.provider,
      canonicalUrl: detected.canonicalUrl,
      embedId: detected.embedId,
    })
    .run()
  return true
}
