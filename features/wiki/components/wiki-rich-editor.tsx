'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo,
  Redo,
  FileCode2,
  Link as LinkIcon,
  MoreHorizontal,
  Table as TableIcon,
  Code2,
  Minus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  editorHtmlToMarkdown,
  markdownToEditorHtml,
} from '@/features/wiki/wiki-markdown-codec'
import type { ParsedWikiLink } from '@/features/wiki/types'
import { cn } from '@/lib/utils'

/** TipTap Link that preserves wiki data-* attrs through the HTML round-trip. */
const WikiLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (element) => element.getAttribute('class'),
        renderHTML: (attributes) =>
          attributes.class ? { class: attributes.class } : {},
      },
      'data-wiki-kind': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-wiki-kind'),
        renderHTML: (attributes) =>
          attributes['data-wiki-kind']
            ? { 'data-wiki-kind': attributes['data-wiki-kind'] }
            : {},
      },
      'data-wiki-target': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-wiki-target'),
        renderHTML: (attributes) =>
          attributes['data-wiki-target']
            ? { 'data-wiki-target': attributes['data-wiki-target'] }
            : {},
      },
      'data-wiki-raw': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-wiki-raw'),
        renderHTML: (attributes) =>
          attributes['data-wiki-raw']
            ? { 'data-wiki-raw': attributes['data-wiki-raw'] }
            : {},
      },
    }
  },
})

/** Tailwind preflight resets h1–h6 size; restore hierarchy without @tailwindcss/typography. */
const EDITOR_PROSE_CLASS = [
  'wiki-tiptap max-w-none min-h-[380px] px-4 py-3 focus:outline-none',
  'text-sm leading-relaxed text-foreground',
  '[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight',
  '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-2xl [&_h2]:font-semibold',
  '[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-xl [&_h3]:font-semibold',
  '[&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-lg [&_h4]:font-medium',
  '[&_p]:my-2',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6',
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6',
  '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/40 [&_blockquote]:pl-3 [&_blockquote]:italic',
  '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_hr]:my-4 [&_hr]:border-border',
  '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm',
  '[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold',
  '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5',
  '[&_a]:text-primary [&_a]:underline',
].join(' ')

type Props = {
  value: string
  onChange: (markdown: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  onNavigateWikiLink?: (link: ParsedWikiLink) => void
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;')
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
  className,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            aria-pressed={active}
            className={cn(
              'h-8 gap-1 px-2',
              !className && 'w-8 p-0',
              active && 'bg-muted text-foreground',
              className,
            )}
            aria-label={title}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{title}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Single-column wiki editor: rich TipTap preview/edit by default,
 * with Format toolbar + Source Markdown toggle (body SSOT stays Markdown).
 */
export function WikiRichEditor({
  value,
  onChange,
  disabled = false,
  placeholder = 'Write wiki Markdown…',
  className,
  onNavigateWikiLink,
}: Props) {
  const [sourceMode, setSourceMode] = useState(false)
  const lastEmitted = useRef(value)
  const applyingExternal = useRef(false)
  const sourceModeRef = useRef(sourceMode)
  sourceModeRef.current = sourceMode
  const onNavigateRef = useRef(onNavigateWikiLink)
  onNavigateRef.current = onNavigateWikiLink

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled && !sourceMode,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        codeBlock: {
          HTMLAttributes: { class: 'wiki-code-block' },
        },
      }),
      Placeholder.configure({ placeholder }),
      Underline,
      WikiLink.configure({
        openOnClick: false,
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: 'wiki-table' },
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: markdownToEditorHtml(value || ''),
    onUpdate: ({ editor: ed }) => {
      if (applyingExternal.current || sourceModeRef.current) return
      const md = editorHtmlToMarkdown(ed.getHTML())
      lastEmitted.current = md
      onChange(md)
    },
    editorProps: {
      attributes: {
        class: EDITOR_PROSE_CLASS,
      },
      handleClick: (_view, _pos, event) => {
        const navigate = onNavigateRef.current
        const a = (event.target as HTMLElement).closest(
          'a[data-wiki-kind]',
        ) as HTMLAnchorElement | null
        if (!a || !navigate) return false
        event.preventDefault()
        const kind =
          a.dataset.wikiKind === 'tenant_ref' ? 'tenant_ref' : 'local'
        const target = a.dataset.wikiTarget || ''
        navigate({
          raw: a.dataset.wikiRaw || `[[${target}]]`,
          display: a.textContent || target,
          target,
          linkKind: kind,
        })
        return true
      },
    },
  })

  // Sync external value → editor when not typing locally
  useEffect(() => {
    if (!editor || sourceMode) return
    if (value === lastEmitted.current) return
    applyingExternal.current = true
    editor.commands.setContent(markdownToEditorHtml(value || ''), {
      emitUpdate: false,
    })
    lastEmitted.current = value
    applyingExternal.current = false
  }, [value, editor, sourceMode])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled && !sourceMode)
  }, [editor, disabled, sourceMode])

  const toggleSource = useCallback(() => {
    if (!editor) {
      setSourceMode((s) => !s)
      return
    }
    if (!sourceMode) {
      const md = editorHtmlToMarkdown(editor.getHTML())
      lastEmitted.current = md
      onChange(md)
      setSourceMode(true)
    } else {
      applyingExternal.current = true
      editor.commands.setContent(markdownToEditorHtml(value || ''), {
        emitUpdate: false,
      })
      applyingExternal.current = false
      setSourceMode(false)
    }
  }, [editor, sourceMode, onChange, value])

  const insertWikiLink = () => {
    if (!editor || sourceMode) return
    const selected = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      ' ',
    )
    const target = selected.trim() || 'Page Title'
    const safeAttr = escapeAttr(target)
    const safeText = escapeHtml(target)
    const safeRaw = escapeAttr(`[[${target}]]`)
    editor
      .chain()
      .focus()
      .insertContent(
        `<a class="wiki-link wiki-link-local text-primary underline" href="#wiki/${encodeURIComponent(target)}" data-wiki-kind="local" data-wiki-target="${safeAttr}" data-wiki-raw="${safeRaw}">${safeText}</a>`,
      )
      .run()
  }

  if (!editor) {
    return (
      <div className={cn('rounded border border-border', className)}>
        <Textarea
          className="min-h-[420px] font-mono text-sm"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    )
  }

  const formatLabel = editor.isActive('heading', { level: 1 })
    ? 'Heading 1'
    : editor.isActive('heading', { level: 2 })
      ? 'Heading 2'
      : editor.isActive('heading', { level: 3 })
        ? 'Heading 3'
        : editor.isActive('heading', { level: 4 })
          ? 'Heading 4'
          : 'Normal'

  return (
    <div className={cn('overflow-hidden rounded border border-border', className)}>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/50 px-2 py-1.5 backdrop-blur-sm">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo() || sourceMode}
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo() || sourceMode}
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 min-w-[110px] justify-between gap-1 px-2 text-sm"
              disabled={sourceMode || disabled}
            >
              {formatLabel}
              <MoreHorizontal className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => editor.chain().focus().setParagraph().run()}
            >
              Normal
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className="text-xl font-bold"
            >
              <Heading1 className="mr-2 h-4 w-4" /> Heading 1
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className="text-lg font-semibold"
            >
              <Heading2 className="mr-2 h-4 w-4" /> Heading 2
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className="text-base font-semibold"
            >
              <Heading3 className="mr-2 h-4 w-4" /> Heading 3
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
            >
              Heading 4
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          disabled={sourceMode || disabled}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          disabled={sourceMode || disabled}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          disabled={sourceMode || disabled}
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          disabled={sourceMode || disabled}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          disabled={sourceMode || disabled}
          title="Inline code"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          disabled={sourceMode || disabled}
          title="Bullet list"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          disabled={sourceMode || disabled}
          title="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          disabled={sourceMode || disabled}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          disabled={sourceMode || disabled}
          title="Code block"
        >
          <Code2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          active={editor.isActive('table')}
          disabled={sourceMode || disabled}
          title="Insert table"
        >
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          disabled={sourceMode || disabled}
          title="Horizontal rule"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={insertWikiLink}
          disabled={sourceMode || disabled}
          title="Insert [[wikilink]]"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          onClick={toggleSource}
          active={sourceMode}
          disabled={disabled}
          title={
            sourceMode ? 'Switch to rich preview' : 'Edit Source Markdown'
          }
          className="min-w-0 px-2"
        >
          <FileCode2 className="h-4 w-4 shrink-0" />
          <span className="text-xs font-medium">Source Markdown</span>
        </ToolbarButton>
      </div>

      {sourceMode ? (
        <Textarea
          className="min-h-[420px] rounded-none border-0 font-mono text-sm focus-visible:ring-0"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            lastEmitted.current = e.target.value
            onChange(e.target.value)
          }}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  )
}
