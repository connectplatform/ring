'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { TipTapNewsEditor } from '@/features/news/components/editor/tiptap-news-editor'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Send } from 'lucide-react'
import { withLocale } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

type ReviseNewsClientProps = {
  articleId: string
  articleTitle: string
  initialContent: string
  locale: Locale
  slug: string
}

function mapSubmitError(apiError: string | undefined, t: (key: string) => string): string {
  switch (apiError) {
    case 'Unauthorized':
      return t('revise.errorUnauthorized')
    case 'Forbidden':
      return t('revise.errorForbidden')
    case 'Article not found':
      return t('revise.errorNotFound')
    case 'Only published articles accept revisions':
      return t('revise.errorNotPublished')
    default:
      return apiError || t('revise.errorSubmit')
  }
}

export function ReviseNewsClient({
  articleId,
  articleTitle,
  initialContent,
  locale,
  slug,
}: ReviseNewsClientProps) {
  const t = useTranslations('news')
  const router = useRouter()
  const [content, setContent] = useState(initialContent)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const articleHref = withLocale(locale, `/news/${encodeURIComponent(slug)}`)

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    }
  }, [])

  const submitRevision = useCallback(async () => {
    if (!content.trim()) {
      setError(t('revise.errorEmpty'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/news/${articleId}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposedContent: content }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(mapSubmitError(data.error, t))
        return
      }
      setSuccess(true)
      redirectTimerRef.current = setTimeout(() => {
        router.push(articleHref)
      }, 1200)
    } catch {
      setError(t('revise.errorNetwork'))
    } finally {
      setSubmitting(false)
    }
  }, [articleHref, articleId, content, router, t])

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('revise.pageTitle')}</h1>
        <p className="text-muted-foreground">
          {t('revise.editingLead', { title: articleTitle })}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {success ? (
        <Alert>
          <AlertDescription>{t('revise.successReturning')}</AlertDescription>
        </Alert>
      ) : null}

      <TipTapNewsEditor
        content={content}
        onChange={setContent}
        disableAutoSave
        placeholder={t('revise.placeholder')}
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={submitRevision} disabled={submitting || success}>
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {t('revise.submit')}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push(articleHref)}
          disabled={submitting}
        >
          {t('revise.cancel')}
        </Button>
      </div>
    </div>
  )
}
