'use client'

import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import {
  FileText,
  Loader2,
  Pencil,
  Upload,
  CheckCircle,
  X,
  Undo,
  Redo,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { FsModal } from '@/components/ui/fs-modal'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useDebounce } from '@/hooks/use-debounce'
import type { CurriculumVitae } from '@/features/auth/types'
import type {
  WikiRichEditorHistoryApi,
  WikiRichEditorHistoryState,
} from '@/features/wiki/components/wiki-rich-editor'

const WikiRichEditor = dynamic(
  () =>
    import('@/features/wiki/components/wiki-rich-editor').then((m) => m.WikiRichEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      </div>
    ),
  },
)

const CV_ACCEPT =
  'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/jpg,image/png,.pdf,.doc,.docx,.jpg,.jpeg,.png'

type CurriculumVitaeWidgetProps = {
  value?: CurriculumVitae | null
  onSaved?: (cv: CurriculumVitae) => void
  className?: string
}

/**
 * My Curriculum Vitae — markdown editor (FsModal) + file upload (profile:cv).
 * Mobile editor is full-bleed; drafts use hydration-safe `useLocalStorage` (same SSOT as chat composer).
 */
export function CurriculumVitaeWidget({
  value,
  onSaved,
  className,
}: CurriculumVitaeWidgetProps) {
  const t = useTranslations('modules.profile')
  const tEditor = useTranslations('editor.toolbar')
  const { data: session, update: updateSession } = useSession()
  const userId = session?.user?.id
  const draftKey = userId ? `profile_cv_draft_${userId}` : 'profile_cv_draft'
  const [storedDraft, setStoredDraft] = useLocalStorage<string>(draftKey, '')
  const fileRef = useRef<HTMLInputElement>(null)
  const historyRef = useRef<WikiRichEditorHistoryApi | null>(null)
  const [history, setHistory] = useState<WikiRichEditorHistoryState>({
    canUndo: false,
    canRedo: false,
  })
  const onHistoryChange = useCallback((state: WikiRichEditorHistoryState) => {
    setHistory(state)
  }, [])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value?.markdown || '')
  const [cv, setCv] = useState<CurriculumVitae>(value || {})
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const debouncedDraft = useDebounce(draft, 800)
  const draftDirty =
    open &&
    debouncedDraft === draft &&
    draft.trim() !== (cv.markdown || '').trim() &&
    draft.trim().length > 0

  useEffect(() => {
    setCv(value || {})
    if (!open) setDraft(value?.markdown || '')
  }, [value, open])

  // Autosave draft to localStorage while the editor is open (chat-composer pattern).
  useEffect(() => {
    if (!open) return
    if (debouncedDraft === draft) {
      setStoredDraft(draft)
    }
  }, [open, draft, debouncedDraft, setStoredDraft])

  const persist = (next: CurriculumVitae, opts?: { close?: boolean; clearDraft?: boolean }) => {
    startTransition(async () => {
      setError(null)
      try {
        const formData = new FormData()
        formData.append('curriculumVitae', JSON.stringify(next))
        const { updateProfile } = await import('@/app/_actions/profile')
        const result = await updateProfile({ success: false, message: '' }, formData)
        if (!result.success) {
          setError(result.message || t('cvSaveFailed'))
          return
        }
        setCv(next)
        if (opts?.clearDraft) setStoredDraft('')
        await updateSession()
        onSaved?.(next)
        if (opts?.close) setOpen(false)
      } catch {
        setError(t('cvSaveFailed'))
      }
    })
  }

  const handleSaveAndExit = () => {
    const next: CurriculumVitae = {
      ...cv,
      markdown: draft,
      updatedAt: new Date().toISOString(),
    }
    persist(next, { close: true, clearDraft: true })
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    setUploadProgress(10)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('purpose', 'profile:cv')
      formData.append('fileType', 'cv')
      const res = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      })
      setUploadProgress(70)
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || t('cvUploadFailed'))
      }
      setUploadProgress(100)
      const next: CurriculumVitae = {
        ...cv,
        file: {
          objectKey: data.objectKey,
          fileName: data.filename || file.name,
          contentType: data.contentType || file.type,
          url: data.url || data.downloadUrl || undefined,
          uploadedAt: data.uploadedAt || new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      }
      persist(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('cvUploadFailed'))
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const clearFile = () => {
    const next: CurriculumVitae = { ...cv, file: undefined, updatedAt: new Date().toISOString() }
    persist(next)
  }

  const openEditor = () => {
    const serverMd = cv.markdown || ''
    const fromDraft = storedDraft.trim().length > 0 ? storedDraft : serverMd
    setDraft(fromDraft)
    setError(null)
    setOpen(true)
  }

  const hasMarkdown = Boolean(cv.markdown?.trim())
  const preview =
    cv.markdown?.trim().slice(0, 160) ||
    (cv.file ? t('cvFileAttached', { name: cv.file.fileName }) : t('cvEmpty'))

  return (
    <div className={cn(davinciGlassSurface, 'space-y-4 p-4 sm:p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-5 w-5 text-[var(--davinci-beam)]" />
            {t('cvTitle')}
          </h3>
          <p className="text-sm text-muted-foreground">{t('cvDescription')}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={openEditor}
        >
          <Pencil className="h-3.5 w-3.5" />
          {t('cvEdit')}
        </Button>
      </div>

      <p className="line-clamp-3 text-sm text-muted-foreground whitespace-pre-wrap">
        {preview}
        {hasMarkdown && (cv.markdown?.length || 0) > 160 ? '…' : ''}
      </p>

      {cv.file ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="min-w-0 flex-1 truncate font-medium">{cv.file.fileName}</span>
          {cv.file.url ? (
            <Button asChild variant="link" size="sm" className="h-auto px-0">
              <a href={cv.file.url} target="_blank" rel="noreferrer">
                {t('cvOpenFile')}
              </a>
            </Button>
          ) : null}
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-full border border-border/80 text-muted-foreground hover:text-destructive"
            aria-label={t('cvRemoveFile')}
            disabled={pending || uploading}
            onClick={clearFile}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept={CV_ACCEPT}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleUpload(file)
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={uploading || pending}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {t('cvUpload')}
        </Button>
        <span className="text-xs text-muted-foreground">{t('cvUploadHint')}</span>
      </div>

      {uploading ? <Progress value={uploadProgress} className="h-1.5" /> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <FsModal
        open={open}
        onOpenChange={setOpen}
        title={t('cvEditTitle')}
        hideHeaderSeparator
        hideFooterSeparator
        hideTitleOnMobile
        hideCloseButton
        className={cn(
          'sm:h-[100dvh] sm:max-h-[100dvh] sm:max-w-4xl',
          // Mobile: reclaim top padding reserved for the default close control.
          'max-sm:!pt-0 max-sm:min-h-[100dvh]',
        )}
        headerClassName="max-sm:hidden sm:block"
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden !p-0"
        footerClassName="max-sm:px-4 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:pt-2"
        footer={
          <div className="flex w-full items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0"
              disabled={!history.canUndo}
              aria-label={tEditor('undo')}
              onClick={() => historyRef.current?.undo()}
            >
              <Undo className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0"
              disabled={!history.canRedo}
              aria-label={tEditor('redo')}
              onClick={() => historyRef.current?.redo()}
            >
              <Redo className="h-5 w-5" />
            </Button>
            <div className="ml-auto flex items-center gap-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="button" disabled={pending} onClick={handleSaveAndExit}>
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('cvSaveAndExit')}
              </Button>
            </div>
          </div>
        }
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden max-sm:h-full">
          <WikiRichEditor
            value={draft}
            onChange={setDraft}
            placeholder={t('cvEditorPlaceholder')}
            onRequestClose={() => setOpen(false)}
            historyRef={historyRef}
            onHistoryChange={onHistoryChange}
            className="min-h-0 flex-1 max-sm:h-full max-sm:min-h-[calc(100dvh-5.5rem)] sm:min-h-[60dvh]"
          />
          {draftDirty ? (
            <span className="pointer-events-none absolute bottom-3 left-4 z-10 text-xs text-muted-foreground">
              {t('cvDraftSaved')}
            </span>
          ) : null}
        </div>
      </FsModal>
    </div>
  )
}
