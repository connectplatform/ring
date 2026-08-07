'use client'

import React, { useCallback, useState } from 'react'
import { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  Highlighter,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  SeparatorHorizontal,
  Minus,
  Plus,
  MoreHorizontal,
  Calculator,
  BookOpen,
  Eraser
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { EquationEditor } from './equation-editor'
import { useTranslations } from 'next-intl'

interface EditorToolbarProps {
  editor: Editor | null
}

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

/**
 * EditorToolbar - Scientific-themed toolbar with comprehensive formatting controls
 * 
 * Features:
 * - Format dropdown (Normal, H1-H6)
 * - Text formatting (Bold, Italic, Underline, Strike)
 * - Scientific formatting (Superscript, Subscript, Highlight)
 * - Alignment controls (Left, Center, Right, Justify)
 * - List controls (Bullet, Numbered)
 * - Insert controls (Link, Image, Table, Code Block)
 * - Undo/Redo buttons
 * - Word count display
 */
export function EditorToolbar({ editor }: EditorToolbarProps) {
  const t = useTranslations('editor.toolbar')
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [showImageDialog, setShowImageDialog] = useState(false)
  const [showTableDialog, setShowTableDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageAlt, setImageAlt] = useState('')
  const [tableRows, setTableRows] = useState(3)
  const [tableCols, setTableCols] = useState(3)
  const [showEquationModal, setShowEquationModal] = useState(false)
  const [prontoScanResult, setProntoScanResult] = useState<{ valid: number; dbMatched: number; needsCorrection: number } | null>(null)

  if (!editor) return null

  const runPronto = () => {
    editor.chain().focus().runCitationDetector((result) => setProntoScanResult(result)).run()
  }
  const clearPronto = () => {
    editor.chain().focus().clearCitationDecorations().run()
    setProntoScanResult(null)
  }


  // Check if format is active
  const isActive = (format: string, attributes?: Record<string, unknown>) => {
    return editor.isActive(format, attributes)
  }

  // Format handlers
  const toggleBold = () => editor.chain().focus().toggleBold().run()
  const toggleItalic = () => editor.chain().focus().toggleItalic().run()
  const toggleUnderline = () => editor.chain().focus().toggleUnderline().run()
  const toggleStrike = () => editor.chain().focus().toggleStrike().run()
  const toggleCode = () => editor.chain().focus().toggleCode().run()
  const toggleHighlight = () => editor.chain().focus().toggleHighlight().run()
  const toggleSubscript = () => editor.chain().focus().toggleSubscript().run()
  const toggleSuperscript = () => editor.chain().focus().toggleSuperscript().run()
  
  const setHeading = (level: HeadingLevel) => editor.chain().focus().toggleHeading({ level }).run()
  const setParagraph = () => editor.chain().focus().setParagraph().run()
  
  const toggleBulletList = () => editor.chain().focus().toggleBulletList().run()
  const toggleOrderedList = () => editor.chain().focus().toggleOrderedList().run()
  const toggleBlockquote = () => editor.chain().focus().toggleBlockquote().run()
  const toggleCodeBlock = () => editor.chain().focus().toggleCodeBlock().run()
  
  const setTextAlign = (align: 'left' | 'center' | 'right' | 'justify') => {
    editor.chain().focus().setTextAlign(align).run()
  }
  
  const insertHorizontalRule = () => editor.chain().focus().setHorizontalRule().run()
  
  const undo = () => editor.chain().focus().undo().run()
  const redo = () => editor.chain().focus().redo().run()

  // Link insertion
  const insertLink = () => {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
      setLinkUrl('')
      setLinkText('')
      setShowLinkDialog(false)
    }
  }

  const removeLink = () => {
    editor.chain().focus().unsetLink().run()
  }

  // Image insertion
  const insertImage = () => {
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl, alt: imageAlt }).run()
      setImageUrl('')
      setImageAlt('')
      setShowImageDialog(false)
    }
  }

  // Table insertion
  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: true }).run()
    setShowTableDialog(false)
  }

  // Equation insertion (mathBlock node)
  const insertEquation = (latex: string, display: boolean) => {
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'mathBlock',
        attrs: { latex: latex.trim() || 'E = mc^2', display }
      })
      .run()
  }

  // Get current heading level text
  const getCurrentFormat = () => {
    if (isActive('heading', { level: 1 })) return t('heading1')
    if (isActive('heading', { level: 2 })) return t('heading2')
    if (isActive('heading', { level: 3 })) return t('heading3')
    if (isActive('heading', { level: 4 })) return t('heading4')
    if (isActive('heading', { level: 5 })) return t('heading5')
    if (isActive('heading', { level: 6 })) return t('heading6')
    return t('normal')
  }

  // Calculate word count
  const wordCount = editor.getText().split(/\s+/).filter(Boolean).length
  const charCount = editor.getText().length

  // Toolbar button component
  const ToolbarButton = ({
    onClick,
    active,
    disabled,
    title,
    children
  }: {
    onClick: () => void
    active?: boolean
    disabled?: boolean
    title: string
    children: React.ReactNode
  }) => (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            className={`h-8 w-8 p-0 ${active ? 'bg-[#1e3a5f]/10 text-[#1e3a5f]' : ''}`}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{title}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  return (
    <>
      {/* Main Toolbar */}
      <div className="sticky top-0 z-10 border-b border-border bg-muted/50 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-1 px-4 py-2">
          {/* Undo/Redo */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton 
              onClick={undo} 
              disabled={!editor.can().undo()}
              title={`${t('undo')} (Ctrl+Z)`}
            >
              <Undo className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={redo} 
              disabled={!editor.can().redo()}
              title={`${t('redo')} (Ctrl+Y)`}
            >
              <Redo className="h-4 w-4" />
            </ToolbarButton>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Heading Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-sm h-8 px-2 min-w-[120px] justify-between">
                {getCurrentFormat()}
                <MoreHorizontal className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={setParagraph}>
                {t('normal')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setHeading(1)} className="text-2xl font-bold">
                {t('heading1')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHeading(2)} className="text-xl font-semibold">
                {t('heading2')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHeading(3)} className="text-lg font-semibold">
                {t('heading3')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHeading(4)} className="text-base font-semibold">
                {t('heading4')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Text Formatting */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton 
              onClick={toggleBold} 
              active={isActive('bold')}
              title={`${t('bold')} (Ctrl+B)`}
            >
              <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={toggleItalic} 
              active={isActive('italic')}
              title={`${t('italic')} (Ctrl+I)`}
            >
              <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={toggleUnderline} 
              active={isActive('underline')}
              title={`${t('underline')} (Ctrl+U)`}
            >
              <UnderlineIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={toggleStrike} 
              active={isActive('strike')}
              title={t('strikethrough')}
            >
              <Strikethrough className="h-4 w-4" />
            </ToolbarButton>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Scientific Formatting */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton 
              onClick={toggleSuperscript} 
              active={isActive('superscript')}
              title={t('superscript')}
            >
              <SuperscriptIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={toggleSubscript} 
              active={isActive('subscript')}
              title={t('subscript')}
            >
              <SubscriptIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={toggleHighlight} 
              active={isActive('highlight')}
              title={t('highlight')}
            >
              <Highlighter className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={toggleCode} 
              active={isActive('code')}
              title={t('inlineCode')}
            >
              <Code className="h-4 w-4" />
            </ToolbarButton>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Alignment */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton 
              onClick={() => setTextAlign('left')} 
              active={editor.isActive({ textAlign: 'left' })}
              title={t('alignLeft')}
            >
              <AlignLeft className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={() => setTextAlign('center')} 
              active={editor.isActive({ textAlign: 'center' })}
              title={t('alignCenter')}
            >
              <AlignCenter className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={() => setTextAlign('right')} 
              active={editor.isActive({ textAlign: 'right' })}
              title={t('alignRight')}
            >
              <AlignRight className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={() => setTextAlign('justify')} 
              active={editor.isActive({ textAlign: 'justify' })}
              title={t('justify')}
            >
              <AlignJustify className="h-4 w-4" />
            </ToolbarButton>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Lists */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton 
              onClick={toggleBulletList} 
              active={isActive('bulletList')}
              title={t('bulletList')}
            >
              <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={toggleOrderedList} 
              active={isActive('orderedList')}
              title={t('numberedList')}
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={toggleBlockquote} 
              active={isActive('blockquote')}
              title={t('quote')}
            >
              <Quote className="h-4 w-4" />
            </ToolbarButton>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Insert Elements */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton 
              onClick={() => setShowLinkDialog(true)}
              active={isActive('link')}
              title={t('insertLink')}
            >
              <LinkIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={() => setShowImageDialog(true)}
              title={t('insertImage')}
            >
              <ImageIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={() => setShowTableDialog(true)}
              title={t('insertTable')}
            >
              <TableIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={toggleCodeBlock} 
              active={isActive('codeBlock')}
              title={t('codeBlock')}
            >
              <Code className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={() => setShowEquationModal(true)}
              title={`${t('insertEquation')} (Ctrl+M)`}
            >
              <Calculator className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={insertHorizontalRule}
              title={t('horizontalRule')}
            >
              <SeparatorHorizontal className="h-4 w-4" />
            </ToolbarButton>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Pronto: highlight references / citation detector - visible label per Ring toolbar pattern */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={runPronto}
                    className="h-8 px-2 gap-1.5 text-xs font-medium text-[#1e3a5f] hover:bg-[#1e3a5f]/10"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>Pronto</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('highlightRefs')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ToolbarButton 
              onClick={clearPronto}
              title={t('clearRefHighlights')}
            >
              <Eraser className="h-4 w-4" />
            </ToolbarButton>
            {prontoScanResult && (
              <span className="text-xs text-muted-foreground ml-1 whitespace-nowrap">
                {t('valid')}: {prontoScanResult.valid} · {t('inLibrary')}: {prontoScanResult.dbMatched} · {t('needsFix')}: {prontoScanResult.needsCorrection}
              </span>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Word Count */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{t('words')}: {wordCount}</span>
            <span>{t('chars')}: {charCount}</span>
          </div>
        </div>
      </div>

      {/* Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('insertLink')}</DialogTitle>
            <DialogDescription>
              {t('linkDialogDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('url')}</Label>
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {isActive('link') && (
              <Button variant="destructive" onClick={() => { removeLink(); setShowLinkDialog(false) }}>
                {t('removeLink')}
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={insertLink} disabled={!linkUrl}>
              {t('insert')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('insertImage')}</DialogTitle>
            <DialogDescription>
              {t('imageDialogDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('imageUrl')}</Label>
              <Input
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('altText')}</Label>
              <Input
                placeholder={t('imageDesc')}
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImageDialog(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={insertImage} disabled={!imageUrl}>
              {t('insert')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Dialog */}
      <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('insertTable')}</DialogTitle>
            <DialogDescription>
              {t('tableDialogDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <Label>{t('rows')}</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setTableRows(Math.max(1, tableRows - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center">{tableRows}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setTableRows(tableRows + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <Label>{t('columns')}</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setTableCols(Math.max(1, tableCols - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center">{tableCols}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setTableCols(tableCols + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            {/* Table Preview Grid */}
            <div className="border rounded-lg p-3 bg-muted/30">
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${tableCols}, 1fr)` }}>
                {Array.from({ length: tableRows * tableCols }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-6 border rounded ${i < tableCols ? 'bg-[#1e3a5f]/20' : 'bg-background'}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTableDialog(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={insertTable}>
              {t('insert')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Equation Editor Modal */}
      <EquationEditor
        open={showEquationModal}
        onOpenChange={setShowEquationModal}
        onInsert={insertEquation}
      />
    </>
  )
}

