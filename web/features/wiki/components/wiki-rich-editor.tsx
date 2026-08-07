'use client'

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
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
  Undo,
  Redo,
  FileCode2,
  Link as LinkIcon,
  ChevronDown,
  Table as TableIcon,
  Minus,
  ImageIcon,
  X,
  Moon,
  Sun,
} from 'lucide-react'
import { useTheme } from 'next-themes'
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
import { WikiImageGalleryFsModal } from '@/features/wiki/components/wiki-image-gallery-fs-modal'
import { WikiTerminalCaret } from '@/features/wiki/extensions/wiki-terminal-caret'
import {
  readEditorSelection,
  writeEditorSelection,
} from '@/features/wiki/lib/editor-selection-memory'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { toggleThemeWithTransition } from '@/lib/theme/ring-theme-transition'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

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
  // Body text 1.75× prior text-sm (0.875rem → ~1.53125rem) for mobile readability;
  // terminal block caret via WikiTerminalCaret (styles/davinci.css .wiki-terminal-caret).
  'wiki-tiptap max-w-none min-h-[380px] px-3 py-2.5 pb-8 focus:outline-none',
  'text-[1.53125rem] leading-relaxed text-foreground',
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
  '[&_img]:my-3 [&_img]:max-h-80 [&_img]:max-w-full [&_img]:rounded-md [&_img]:object-contain',
].join(' ')

export type WikiRichEditorHistoryApi = {
  undo: () => void
  redo: () => void
}

export type WikiRichEditorHistoryState = {
  canUndo: boolean
  canRedo: boolean
}

type Props = {
  value: string
  onChange: (markdown: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  onNavigateWikiLink?: (link: ParsedWikiLink) => void
  /**
   * Shows Close on the toolbar.
   * Default: phone-only (`max-sm`); desktop/iPad use FsModal `headerActions` instead.
   */
  onRequestClose?: () => void
  /** When true, toolbar Close is phone-only (`max-sm:flex sm:hidden`). Default true. */
  closeOnToolbarMobileOnly?: boolean
  /** Focus ProseMirror on mount (opens mobile keyboard). */
  autoFocus?: boolean
  /**
   * Persist/restore TipTap `{ from, to }` (+ scroll) via localStorage —
   * same versioned-key spirit as cursor-feed pagination (`ring-editor-sel-{scope}`).
   */
  selectionMemoryScope?: string
  /**
   * When set, undo/redo stay out of the toolbar; parent renders them (e.g. Cancel/Save row).
   * Also keeps an always-fresh API on the ref.
   */
  historyRef?: React.MutableRefObject<WikiRichEditorHistoryApi | null>
  onHistoryChange?: (state: WikiRichEditorHistoryState) => void
  /**
   * News-only: when clipboard is a lone URL, return a Markdown block to insert
   * (e.g. `[[embed:url]]`). Return null to use default paste. CV/wiki omit this.
   */
  onLoneUrlPaste?: (url: string) => string | null
  /**
   * News-only: keep [[mood:]] / [[embed:]] / [[video:]] as literal text in the
   * editor (do not promote to wiki-link anchors). CV/wiki omit this.
   */
  preserveNewsShortcodes?: boolean
}

type HeadingLevel = 1 | 2 | 3 | 4

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
              // ~1.125× original (prior 1.25× reduced ~10% for mobile row fit)
              'h-11 gap-1 px-2.5',
              !className && 'w-11 p-0',
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
 * Single-column wiki / CV editor: rich TipTap by default, Raw .md toggle.
 * Toolbar: row1 Style + B/I/U/S + quote (+ theme/close); row2 insert tools + lists + Raw .md.
 */
export const WikiRichEditor = forwardRef<WikiRichEditorHistoryApi | null, Props>(
  function WikiRichEditor(
    {
      value,
      onChange,
      disabled = false,
      placeholder = 'Write wiki Markdown…',
      className,
      onNavigateWikiLink,
      onRequestClose,
      closeOnToolbarMobileOnly = true,
      autoFocus = false,
      selectionMemoryScope,
      historyRef,
      onHistoryChange,
      onLoneUrlPaste,
      preserveNewsShortcodes = false,
    },
    ref,
  ) {
    const t = useTranslations('editor.toolbar')
    const tTheme = useTranslations('common.labels')
    const { setTheme, theme, resolvedTheme } = useTheme()
    const [themeMounted, setThemeMounted] = useState(false)
    useEffect(() => setThemeMounted(true), [])
    const themeIsDark = themeMounted && resolvedTheme === 'dark'
    const [sourceMode, setSourceMode] = useState(false)
    const [galleryOpen, setGalleryOpen] = useState(false)
    const [historyState, setHistoryState] = useState<WikiRichEditorHistoryState>({
      canUndo: false,
      canRedo: false,
    })
    const lastEmitted = useRef(value)
    const applyingExternal = useRef(false)
    const sourceModeRef = useRef(sourceMode)
    sourceModeRef.current = sourceMode
    const onNavigateRef = useRef(onNavigateWikiLink)
    onNavigateRef.current = onNavigateWikiLink
    const onLoneUrlPasteRef = useRef(onLoneUrlPaste)
    onLoneUrlPasteRef.current = onLoneUrlPaste
    const preserveNewsShortcodesRef = useRef(preserveNewsShortcodes)
    preserveNewsShortcodesRef.current = preserveNewsShortcodes
    const editorInstanceRef = useRef<ReturnType<typeof useEditor>>(null)
    const externalHistory = Boolean(historyRef || onHistoryChange)

    const mdToHtml = (md: string) =>
      markdownToEditorHtml(md || '', {
        preserveNewsShortcodes: preserveNewsShortcodesRef.current,
      })

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
        Image.configure({
          inline: false,
          allowBase64: false,
        }),
        WikiTerminalCaret,
        Table.configure({
          resizable: true,
          HTMLAttributes: { class: 'wiki-table' },
        }),
        TableRow,
        TableHeader,
        TableCell,
      ],
      content: mdToHtml(value || ''),
      onUpdate: ({ editor: ed }) => {
        if (applyingExternal.current || sourceModeRef.current) return
        const md = editorHtmlToMarkdown(ed.getHTML())
        lastEmitted.current = md
        onChange(md)
      },
      onTransaction: ({ editor: ed }) => {
        const next = {
          canUndo: ed.can().undo(),
          canRedo: ed.can().redo(),
        }
        setHistoryState((prev) =>
          prev.canUndo === next.canUndo && prev.canRedo === next.canRedo ? prev : next,
        )
      },
      editorProps: {
        attributes: {
          class: EDITOR_PROSE_CLASS,
        },
        handlePaste: (_view, event) => {
          const handler = onLoneUrlPasteRef.current
          const ed = editorInstanceRef.current
          if (!handler || !ed) return false
          const text = event.clipboardData?.getData('text/plain')?.trim()
          if (!text || /\s/.test(text)) return false
          try {
            const withProto = /^https?:\/\//i.test(text) ? text : `https://${text}`
            // eslint-disable-next-line no-new
            new URL(withProto)
          } catch {
            return false
          }
          const block = handler(text)
          if (!block) return false
          event.preventDefault()
          const safe = block
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
          ed.chain().focus().insertContent(`<p>${safe}</p>`).run()
          return true
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

    editorInstanceRef.current = editor
    useEffect(() => {
      onHistoryChange?.(historyState)
    }, [historyState, onHistoryChange])

    const historyApi: WikiRichEditorHistoryApi = {
      undo: () => editor?.chain().focus().undo().run(),
      redo: () => editor?.chain().focus().redo().run(),
    }

    useImperativeHandle(ref, () => historyApi, [editor])

    useEffect(() => {
      if (!historyRef) return
      historyRef.current = historyApi
      return () => {
        historyRef.current = null
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, historyRef, historyState.canUndo, historyState.canRedo])

    useEffect(() => {
      if (!editor || sourceMode) return
      if (value === lastEmitted.current) return
      applyingExternal.current = true
      editor.commands.setContent(mdToHtml(value || ''), {
        emitUpdate: false,
      })
      lastEmitted.current = value
      applyingExternal.current = false
    }, [value, editor, sourceMode])

    useEffect(() => {
      if (!editor) return
      editor.setEditable(!disabled && !sourceMode)
    }, [editor, disabled, sourceMode])

    // Autofocus + restore caret (cursor-feed-style localStorage memory for selection).
    const selectionRestored = useRef(false)
    useEffect(() => {
      if (!editor || sourceMode) return
      if (selectionRestored.current) {
        if (autoFocus) {
          // Defer so FsModal/Dialog focus trap settles, then open mobile keyboard.
          const t = window.setTimeout(() => {
            editor.commands.focus()
          }, 80)
          return () => window.clearTimeout(t)
        }
        return
      }
      selectionRestored.current = true
      const saved = selectionMemoryScope
        ? readEditorSelection(selectionMemoryScope)
        : null
      const docSize = editor.state.doc.content.size
      if (saved && saved.from >= 0 && saved.from <= docSize) {
        const to = Math.min(Math.max(saved.to, saved.from), docSize)
        editor.commands.setTextSelection({ from: saved.from, to })
        if (typeof saved.scrollTop === 'number') {
          const scroller = editor.view.dom.closest('.overflow-y-auto') as HTMLElement | null
          if (scroller) scroller.scrollTop = saved.scrollTop
        }
        requestAnimationFrame(() => {
          try {
            editor.view.dispatch(editor.state.tr.scrollIntoView())
          } catch {
            /* empty */
          }
        })
      }
      if (autoFocus) {
        const t = window.setTimeout(() => {
          editor.commands.focus(saved ? undefined : 'end')
        }, 80)
        return () => window.clearTimeout(t)
      }
      return undefined
    }, [editor, sourceMode, autoFocus, selectionMemoryScope])

    // Persist selection while editing (feed-session pattern: versioned LS key).
    useEffect(() => {
      if (!editor || !selectionMemoryScope || sourceMode) return
      const persist = () => {
        const { from, to } = editor.state.selection
        const scroller = editor.view.dom.closest('.overflow-y-auto') as HTMLElement | null
        writeEditorSelection(selectionMemoryScope, {
          from,
          to,
          scrollTop: scroller?.scrollTop,
        })
      }
      editor.on('selectionUpdate', persist)
      editor.on('blur', persist)
      return () => {
        editor.off('selectionUpdate', persist)
        editor.off('blur', persist)
      }
    }, [editor, selectionMemoryScope, sourceMode])

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
        editor.commands.setContent(mdToHtml(value || ''), {
          emitUpdate: false,
        })
        applyingExternal.current = false
        setSourceMode(false)
      }
    }, [editor, sourceMode, onChange, value])

    const insertLink = () => {
      if (!editor || sourceMode) return
      const prev = editor.getAttributes('link').href as string | undefined
      const url = window.prompt(t('url'), prev || 'https://')
      if (url === null) return
      if (url.trim() === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run()
        return
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
    }

    const setParagraph = () => {
      if (!editor) return
      editor.chain().focus().setParagraph().run()
    }

    const setHeading = (level: HeadingLevel) => {
      if (!editor) return
      editor.chain().focus().setHeading({ level }).run()
    }

    const iconClass = 'h-5 w-5'
    const toolsDisabled = sourceMode || disabled

    if (!editor) {
      return (
        <div className={cn('overflow-hidden', className)}>
          <Textarea
            className="min-h-[420px] border-0 font-mono text-sm shadow-none focus-visible:ring-0"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        </div>
      )
    }

    return (
      <div className={cn('flex min-h-0 flex-col overflow-hidden', className)}>
        {/* No island bg — flush under title; pt keeps Style hover/active from clipping */}
        <div className="sticky top-0 z-10 w-full shrink-0 border-b border-border/60 bg-background">
          {/* Row 1: Style · B I U S · quote · theme · Close (phone) */}
          <div className="flex w-full flex-wrap items-center gap-0.5 px-1.5 pb-0.5 pt-1 sm:px-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11 min-w-[6rem] justify-between gap-1 px-2.5 text-sm font-medium"
                  disabled={toolsDisabled}
                >
                  {t('style')}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="z-[9300]">
                <DropdownMenuItem
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={setParagraph}
                >
                  {t('normal')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setHeading(1)}
                  className="text-xl font-bold"
                >
                  <Heading1 className="mr-2 h-5 w-5" /> {t('heading1')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setHeading(2)}
                  className="text-lg font-semibold"
                >
                  <Heading2 className="mr-2 h-5 w-5" /> {t('heading2')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setHeading(3)}
                  className="text-base font-semibold"
                >
                  <Heading3 className="mr-2 h-5 w-5" /> {t('heading3')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setHeading(4)}
                >
                  {t('heading4')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="mx-1 h-9" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive('bold')}
              disabled={toolsDisabled}
              title={t('bold')}
            >
              <Bold className={iconClass} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive('italic')}
              disabled={toolsDisabled}
              title={t('italic')}
            >
              <Italic className={iconClass} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              active={editor.isActive('underline')}
              disabled={toolsDisabled}
              title={t('underline')}
            >
              <UnderlineIcon className={iconClass} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              active={editor.isActive('strike')}
              disabled={toolsDisabled}
              title={t('strikethrough')}
            >
              <Strikethrough className={iconClass} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              active={editor.isActive('blockquote')}
              disabled={toolsDisabled}
              title={t('quote')}
            >
              <Quote className={iconClass} />
            </ToolbarButton>

            <div className="ml-auto" />
            <ToolbarButton
              onClick={() =>
                toggleThemeWithTransition(setTheme, theme, resolvedTheme)
              }
              disabled={false}
              title={tTheme('toggleTheme')}
            >
              {!themeMounted ? (
                <Sun className={iconClass} />
              ) : themeIsDark ? (
                <Moon className={iconClass} />
              ) : (
                <Sun className={iconClass} />
              )}
            </ToolbarButton>
            {onRequestClose ? (
              <div
                className={cn(
                  closeOnToolbarMobileOnly && 'max-sm:contents sm:hidden',
                )}
              >
                <ToolbarButton
                  onClick={onRequestClose}
                  disabled={false}
                  title={t('close')}
                >
                  <X className={iconClass} />
                </ToolbarButton>
              </div>
            ) : null}
          </div>

          {/* Row 2: link · table · hr · image · lists · Raw .md */}
          <div className="flex w-full flex-wrap items-center gap-0.5 px-1.5 pb-1.5 pt-0.5 sm:px-2">
            <ToolbarButton
              onClick={insertLink}
              active={editor.isActive('link')}
              disabled={toolsDisabled}
              title={t('insertLink')}
            >
              <LinkIcon className={iconClass} />
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
              disabled={toolsDisabled}
              title={t('insertTable')}
            >
              <TableIcon className={iconClass} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              disabled={toolsDisabled}
              title={t('horizontalRule')}
            >
              <Minus className={iconClass} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => setGalleryOpen(true)}
              disabled={toolsDisabled}
              title={t('insertImage')}
            >
              <ImageIcon className={iconClass} />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-9" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive('bulletList')}
              disabled={toolsDisabled}
              title={t('bulletList')}
            >
              <List className={iconClass} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive('orderedList')}
              disabled={toolsDisabled}
              title={t('numberedList')}
            >
              <ListOrdered className={iconClass} />
            </ToolbarButton>

            <div className="ml-auto" />
            <ToolbarButton
              onClick={toggleSource}
              active={sourceMode}
              disabled={disabled}
              title={sourceMode ? t('switchToRich') : t('editRawMd')}
              className="min-w-0 px-2.5"
            >
              <FileCode2 className={cn(iconClass, 'shrink-0')} />
              <span className="text-xs font-medium whitespace-nowrap sm:text-sm">
                {t('rawMd')}
              </span>
            </ToolbarButton>
          </div>
        </div>

        {/* Editable pane — inset matches toolbar px so edges align */}
        <div
          className={cn(
            'wiki-editor-glass-pane mx-1.5 mb-2 mt-1.5 flex min-h-0 flex-1 flex-col overflow-hidden sm:mx-2 sm:mb-2',
            davinciGlassSurface,
            'bg-[color-mix(in_oklch,var(--davinci-surface-bg)_88%,transparent)]',
          )}
        >
          {sourceMode ? (
            <Textarea
              className="min-h-[420px] flex-1 rounded-none border-0 bg-transparent px-3 py-2.5 font-mono text-[1.53125rem] leading-relaxed shadow-none focus-visible:ring-0 sm:px-3 sm:py-2.5"
              value={value}
              disabled={disabled}
              placeholder={placeholder}
              onChange={(e) => {
                lastEmitted.current = e.target.value
                onChange(e.target.value)
              }}
            />
          ) : (
            <EditorContent
              editor={editor}
              className="min-h-0 flex-1 overflow-y-auto"
            />
          )}
        </div>

        {/* Embedded history when parent does not own Cancel/Save row */}
        {!externalHistory ? (
          <div className="flex w-full shrink-0 items-center gap-1 border-t border-border px-1.5 py-1.5 sm:px-2">
            <ToolbarButton
              onClick={() => historyApi.undo()}
              disabled={!historyState.canUndo || sourceMode}
              title={t('undo')}
            >
              <Undo className={iconClass} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => historyApi.redo()}
              disabled={!historyState.canRedo || sourceMode}
              title={t('redo')}
            >
              <Redo className={iconClass} />
            </ToolbarButton>
          </div>
        ) : null}

        <WikiImageGalleryFsModal
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          onPick={({ src, alt }) => {
            editor.chain().focus().setImage({ src, alt }).run()
          }}
        />
      </div>
    )
  },
)

WikiRichEditor.displayName = 'WikiRichEditor'

export default WikiRichEditor
