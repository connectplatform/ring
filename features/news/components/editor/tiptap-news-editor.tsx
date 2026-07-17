'use client'

/**
 * TipTap News Editor — Notion slash menu, URL embeds, mood player, image upload / AI generate.
 * Replaces TinyMCE for ArticleEditor body editing.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Image from '@tiptap/extension-image'
import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { GenerateImageDialog } from '@/components/media/generate-image-dialog'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link2,
  Music2,
  ImageIcon,
  Sparkles,
  Heading2,
  Quote,
  Loader2,
  Save,
  CheckCircle,
} from 'lucide-react'
import { MoodPlayerNode } from './mood-player-node'
import { RingEmbedExtension } from './extensions/embed-node'
import {
  buildSlashItems,
  tryInsertEmbedFromPaste,
  type SlashCommandItem,
} from './extensions/slash-commands'
import { SlashMenu, type SlashMenuHandle } from './slash-menu'
import { detectEmbedFromUrl } from '@/features/news/lib/editor-widget-detector'

export type TipTapNewsEditorProps = {
  content: string
  onChange: (html: string) => void
  articleId?: string
  placeholder?: string
  disabled?: boolean
  height?: number
  /** When true, parent handles persistence (revise flow). */
  disableAutoSave?: boolean
}

async function uploadNewsInlineImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('purpose', 'news-inline')
  const response = await fetch('/api/entities/upload', {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(err.error || `Upload failed (${response.status})`)
  }
  const result = await response.json()
  if (!result.success || !result.url) {
    throw new Error(result.error || 'Upload returned no URL')
  }
  return result.url as string
}

export function TipTapNewsEditor({
  content,
  onChange,
  articleId,
  placeholder = undefined,
  disabled,
  height = 420,
  disableAutoSave = false,
}: TipTapNewsEditorProps) {
  const t = useTranslations('news')
  const resolvedPlaceholder = placeholder ?? t('editor.placeholder')
  const [playlistId, setPlaylistId] = useState('')
  const [moodDialogOpen, setMoodDialogOpen] = useState(false)
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [autoSaveLabel, setAutoSaveLabel] = useState<string | null>(null)
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)
  const handlersRef = useRef<{
    onRequestImageUpload: () => void
    onRequestGenerateImage: () => void
    onRequestEmbedUrl: () => void
  }>({
    onRequestImageUpload: () => {},
    onRequestGenerateImage: () => {},
    onRequestEmbedUrl: () => {},
  })

  const triggerAutoSave = useCallback(
    async (html: string) => {
      if (disableAutoSave || !articleId || !html.trim()) return
      setIsSaving(true)
      setAutoSaveError(null)
      try {
        const response = await fetch(`/api/news/${articleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: html }),
        })
        const result = await response.json()
        if (!response.ok || !result.success) {
          setAutoSaveError(result.error || 'Auto-save failed')
        } else {
          setAutoSaveLabel(new Date().toLocaleTimeString())
        }
      } catch {
        setAutoSaveError('Auto-save failed — connection error')
      } finally {
        setIsSaving(false)
      }
    },
    [articleId, disableAutoSave],
  )

  const scheduleAutoSave = useCallback(
    (html: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        void triggerAutoSave(html)
      }, 3000)
    },
    [triggerAutoSave],
  )

  const slashItems = useMemo(
    () =>
      buildSlashItems({
        onRequestImageUpload: () => handlersRef.current.onRequestImageUpload(),
        onRequestGenerateImage: () => handlersRef.current.onRequestGenerateImage(),
        onRequestEmbedUrl: () => handlersRef.current.onRequestEmbedUrl(),
      }),
    [],
  )

  const SlashCommands = useMemo(
    () =>
      Extension.create({
        name: 'newsSlashCommands',
        addOptions() {
          return {
            suggestion: {
              char: '/',
              pluginKey: new PluginKey('newsSlashCommands'),
              items: ({ query }: { query: string }) => {
                const q = query.toLowerCase()
                return slashItems.filter(
                  (item) =>
                    item.title.toLowerCase().includes(q) ||
                    item.description.toLowerCase().includes(q),
                )
              },
              command: ({
                editor,
                range,
                props,
              }: {
                editor: Parameters<SlashCommandItem['command']>[0]['editor']
                range: Parameters<SlashCommandItem['command']>[0]['range']
                props: SlashCommandItem
              }) => {
                props.command({ editor, range })
              },
                  render: () => {
                let component: ReactRenderer<SlashMenuHandle> | null = null
                let popup: HTMLDivElement | null = null

                return {
                  onStart: (props: {
                    editor: import('@tiptap/core').Editor
                    items: SlashCommandItem[]
                    command: (item: SlashCommandItem) => void
                    clientRect?: (() => DOMRect | null) | null
                  }) => {
                    component = new ReactRenderer(SlashMenu, {
                      props: {
                        items: props.items,
                        command: props.command,
                      },
                      editor: props.editor,
                    })

                    popup = document.createElement('div')
                    popup.style.position = 'absolute'
                    popup.style.zIndex = '50'
                    document.body.appendChild(popup)
                    popup.appendChild(component.element)

                    const rect = props.clientRect?.()
                    if (rect && popup) {
                      popup.style.left = `${window.scrollX + rect.left}px`
                      popup.style.top = `${window.scrollY + rect.bottom + 6}px`
                    }
                  },
                  onUpdate: (props: {
                    items: SlashCommandItem[]
                    command: (item: SlashCommandItem) => void
                    clientRect?: (() => DOMRect | null) | null
                  }) => {
                    component?.updateProps({
                      items: props.items,
                      command: props.command,
                    })
                    const rect = props.clientRect?.()
                    if (rect && popup) {
                      popup.style.left = `${window.scrollX + rect.left}px`
                      popup.style.top = `${window.scrollY + rect.bottom + 6}px`
                    }
                  },
                  onKeyDown: (props: { event: KeyboardEvent }) => {
                    if (props.event.key === 'Escape') {
                      popup?.remove()
                      component?.destroy()
                      popup = null
                      component = null
                      return true
                    }
                    return component?.ref?.onKeyDown(props) ?? false
                  },
                  onExit: () => {
                    popup?.remove()
                    component?.destroy()
                    popup = null
                    component = null
                  },
                }
              },
            },
          }
        },
        addProseMirrorPlugins() {
          return [
            Suggestion({
              editor: this.editor,
              ...this.options.suggestion,
            }),
          ]
        },
      }),
    [slashItems],
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: resolvedPlaceholder }),
      MoodPlayerNode,
      RingEmbedExtension,
      SlashCommands,
    ],
    content: content || '',
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none min-h-[280px] px-4 py-3 focus:outline-none',
        style: `min-height: ${height - 48}px`,
      },
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData('text/plain')?.trim()
        if (!text) return false
        // Resolve editor from view state via chain when available
        const ed = editorRef.current
        if (!ed) return false
        if (tryInsertEmbedFromPaste(ed, text)) {
          event.preventDefault()
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      onChange(html)
      scheduleAutoSave(html)
    },
  })

  editorRef.current = editor

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (content !== current && content !== undefined) {
      editor.commands.setContent(content || '', { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor])

  useEffect(() => {
    handlersRef.current = {
      onRequestImageUpload: () => fileInputRef.current?.click(),
      onRequestGenerateImage: () => setGenerateDialogOpen(true),
      onRequestEmbedUrl: () => {
        if (!editor) return
        const url = window.prompt('Paste embed URL (YouTube, Rumble, X, Facebook, Suno, or any link)')
        if (!url) return
        const detected = detectEmbedFromUrl(url)
        editor
          .chain()
          .focus()
          .insertRingEmbed({
            provider: detected.provider,
            canonicalUrl: detected.canonicalUrl,
            embedId: detected.embedId,
          })
          .run()
        // Best-effort OG hydrate for card providers (non-blocking)
        if (detected.previewMode === 'card') {
          void fetch('/api/news/embed-preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: detected.canonicalUrl }),
          }).catch(() => {})
        }
      },
    }
  }, [editor])

  const insertMoodPlayer = () => {
    if (!editor || !playlistId.trim()) return
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'moodPlayer',
        attrs: { playlist: playlistId.trim(), showLyrics: 'true' },
      })
      .run()
    setPlaylistId('')
    setMoodDialogOpen(false)
  }

  const insertGeneratedImage = useCallback(
    (url: string) => {
      if (!editor) return
      editor.chain().focus().setImage({ src: url, alt: 'Generated image' }).run()
    },
    [editor],
  )

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !editor) return
    try {
      const url = await uploadNewsInlineImage(file)
      editor.chain().focus().setImage({ src: url, alt: file.name }).run()
    } catch (err) {
      setAutoSaveError(err instanceof Error ? err.message : 'Image upload failed')
    }
  }

  if (!editor) {
    return <div className="min-h-[320px] animate-pulse rounded border bg-muted/30" />
  }

  return (
    <div className="space-y-3">
      <GenerateImageDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
        purpose={articleId ? `news-inline-${articleId}` : 'news-inline'}
        defaultAspectRatio="16:9"
        title="Generate inline image"
        onImageReady={insertGeneratedImage}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileSelected}
      />

      {articleId && !disableAutoSave ? (
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-2 text-sm">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span>{t('editor.saving')}</span>
              </>
            ) : autoSaveError ? (
              <span className="text-destructive">{autoSaveError}</span>
            ) : autoSaveLabel ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-700">
                  {t('editor.autoSavedAt', { time: autoSaveLabel })}
                </span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('editor.autoSaveEnabled')}</span>
              </>
            )}
          </div>
          <Badge variant="outline" className="text-xs">
            TipTap
          </Badge>
        </div>
      ) : null}

      {autoSaveError && !(articleId && !disableAutoSave) ? (
        <Alert variant="destructive">
          <AlertDescription>{autoSaveError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-lg border">
        <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={disabled}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={disabled}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            disabled={disabled}
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            disabled={disabled}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            disabled={disabled}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            disabled={disabled}
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              const url = window.prompt('Link URL')
              if (url) editor.chain().focus().setLink({ href: url }).run()
            }}
            disabled={disabled}
          >
            <Link2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setGenerateDialogOpen(true)}
            disabled={disabled}
          >
            <Sparkles className="h-4 w-4" />
          </Button>

          <Dialog open={moodDialogOpen} onOpenChange={setMoodDialogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1"
                disabled={disabled}
              >
                <Music2 className="h-4 w-4" /> Mood
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Insert Mood Player widget</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="playlistId">Playlist ID</Label>
                  <Input
                    id="playlistId"
                    value={playlistId}
                    onChange={(e) => setPlaylistId(e.target.value)}
                    placeholder="UUID from /profile/player/playlists"
                  />
                </div>
                <Button type="button" onClick={insertMoodPlayer} disabled={!playlistId.trim()}>
                  Insert widget
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
            {t('editor.slashHint')}
          </span>
        </div>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
