'use client'

import React, { useEffect, useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useTranslations } from 'next-intl'

const TEMPLATES = [
  { label: 'Fraction', latex: '\\frac{a}{b}' },
  { label: 'Square root', latex: '\\sqrt{x}' },
  { label: 'Sum', latex: '\\sum_{i=1}^{n} x_i' },
  { label: 'Integral', latex: '\\int_0^1 f(x)\\,dx' },
  { label: 'Greek', latex: '\\alpha, \\beta, \\gamma' },
  { label: 'Matrix', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
]

export interface EquationEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (latex: string, display: boolean) => void
  initialLatex?: string
  initialDisplay?: boolean
}

export function EquationEditor({
  open,
  onOpenChange,
  onInsert,
  initialLatex = '',
  initialDisplay = true,
}: EquationEditorProps) {
  const t = useTranslations('editor.equation')
  const [latex, setLatex] = useState(initialLatex)
  const [display, setDisplay] = useState(initialDisplay)
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLatex(initialLatex)
    setDisplay(initialDisplay ?? true)
  }, [open, initialLatex, initialDisplay])

  useEffect(() => {
    if (!latex.trim()) {
      setPreviewHtml('')
      setError(null)
      return
    }
    try {
      const html = katex.renderToString(latex, {
        displayMode: display,
        throwOnError: true,
        output: 'html',
        strict: false,
      })
      setPreviewHtml(html)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid LaTeX')
      setPreviewHtml('')
    }
  }, [latex, display])

  const handleInsert = () => {
    const toInsert = latex.trim() || 'E = mc^2'
    onInsert(toInsert, display)
    onOpenChange(false)
    setLatex('')
  }

  const insertTemplate = (templateLatex: string) => {
    setLatex((prev) => (prev ? `${prev} ${templateLatex}` : templateLatex))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('latexLabel')}</Label>
            <Textarea
              placeholder="E = mc^2"
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              className="min-h-[80px] font-mono text-sm"
              data-testid="equation-latex-input"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="display-mode"
              checked={display}
              onCheckedChange={setDisplay}
            />
            <Label htmlFor="display-mode" className="cursor-pointer">
              {t('displayBlock')}
            </Label>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">
              {t('preview')}
            </Label>
            <div
              className={`min-h-[48px] rounded border border-border bg-muted/30 p-3 ${display ? 'text-center' : ''}`}
              data-testid="equation-preview"
            >
              {error ? (
                <span className="text-destructive text-sm italic">{error}</span>
              ) : previewHtml ? (
                <span dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <span className="text-muted-foreground italic">
                  {t('previewPlaceholder')}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">
              {t('templates')}
            </Label>
            <div className="flex flex-wrap gap-1">
              {TEMPLATES.map((tpl) => (
                <Button
                  key={tpl.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => insertTemplate(tpl.latex)}
                >
                  {tpl.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleInsert} data-testid="equation-insert-btn">
            {t('insert')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
