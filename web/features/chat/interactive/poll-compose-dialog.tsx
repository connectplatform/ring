'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { createPollMessage } from '@/app/_actions/chat-poll'
import { toast } from '@/hooks/use-toast'

export interface PollComposeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId: string
}

/** Convert datetime-local value to ISO for PollMetadata.closeAt */
function localDatetimeToIso(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const ms = new Date(trimmed).getTime()
  if (!Number.isFinite(ms)) return undefined
  return new Date(ms).toISOString()
}

export function PollComposeDialog({
  open,
  onOpenChange,
  conversationId,
}: PollComposeDialogProps) {
  const t = useTranslations('modules.messenger')
  const [question, setQuestion] = useState('')
  const [optionsText, setOptionsText] = useState('Yes\nNo')
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [closeAtLocal, setCloseAtLocal] = useState('')
  const [pending, startTransition] = useTransition()

  const reset = () => {
    setQuestion('')
    setOptionsText('Yes\nNo')
    setAllowMultiple(false)
    setCloseAtLocal('')
  }

  const onSubmit = () => {
    const options = optionsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    startTransition(async () => {
      const result = await createPollMessage({
        conversationId,
        question,
        options,
        allowMultiple,
        closeAt: localDatetimeToIso(closeAtLocal),
      })
      if (!result.success) {
        toast({ title: result.error ?? t('pollCreateFailed'), variant: 'destructive' })
        return
      }
      toast({ title: t('pollCreated') })
      reset()
      onOpenChange(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pollComposeTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="poll-question">{t('pollQuestion')}</Label>
            <Input
              id="poll-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t('pollQuestionPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="poll-options">{t('pollOptions')}</Label>
            <textarea
              id="poll-options"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder={t('pollOptionsPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="poll-close-at">{t('pollCloseAt')}</Label>
            <Input
              id="poll-close-at"
              type="datetime-local"
              value={closeAtLocal}
              onChange={(e) => setCloseAtLocal(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">{t('pollCloseAtHint')}</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="poll-multi">{t('pollAllowMultiple')}</Label>
            <Switch
              id="poll-multi"
              checked={allowMultiple}
              onCheckedChange={setAllowMultiple}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('pollCancel')}
          </Button>
          <Button type="button" disabled={pending || !question.trim()} onClick={onSubmit}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('pollCreate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PollComposeDialog
