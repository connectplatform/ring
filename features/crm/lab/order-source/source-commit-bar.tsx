'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Save, Sparkles } from 'lucide-react'

export function SourceCommitBar({
  orderId,
  path,
  oldContent,
  newContent,
  message,
  dirty,
  pending,
  disabled,
  onMessageChange,
  onCommit,
}: {
  orderId: string
  path: string | null
  oldContent: string
  newContent: string
  message: string
  dirty: boolean
  pending: boolean
  disabled?: boolean
  onMessageChange: (v: string) => void
  onCommit: () => void
}) {
  const t = useTranslations('calculator')
  const [suggesting, startSuggest] = useTransition()
  const [suggestError, setSuggestError] = useState<string | null>(null)

  if (disabled) return null

  const suggest = () => {
    if (!path || !dirty) return
    setSuggestError(null)
    startSuggest(async () => {
      try {
        const res = await fetch(`/api/my-jobs/${orderId}/source/suggest-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path,
            oldContent,
            newContent,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Suggest failed')
        if (typeof json.suggestion === 'string' && json.suggestion.trim()) {
          onMessageChange(json.suggestion.trim())
        }
      } catch (e) {
        setSuggestError(e instanceof Error ? e.message : 'Suggest failed')
      }
    })
  }

  const busy = pending || suggesting

  return (
    <div className="space-y-1 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="min-w-[200px] flex-1"
          disabled={busy}
          placeholder={t('order.source.commitMessagePlaceholder')}
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && dirty && message.trim()) onCommit()
          }}
        />
        <Button
          disabled={!dirty || busy || !path}
          size="sm"
          type="button"
          variant="outline"
          title={t('order.source.suggestMessage')}
          onClick={suggest}
        >
          {suggesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          <span className="sr-only">{t('order.source.suggestMessage')}</span>
        </Button>
        <Button
          disabled={!dirty || !message.trim() || busy}
          size="sm"
          type="button"
          onClick={onCommit}
        >
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {t('order.source.commit')}
        </Button>
      </div>
      {suggestError ? <p className="text-xs text-destructive">{suggestError}</p> : null}
    </div>
  )
}
