'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createGameRequest } from '@/app/_actions/peer-games'
import { listCatalog } from '@/features/peer-games/catalog'
import { localizedCatalogTitle } from '@/features/peer-games/lib/catalog-i18n'
import { usePeerCallBusy } from '@/features/peer-games/lib/peer-game-mutex'
import { toast } from '@/hooks/use-toast'

export interface GameRequestComposeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId: string
  /** Block compose while WebRTC call is active. */
  callBusy?: boolean
}

export function GameRequestComposeDialog({
  open,
  onOpenChange,
  conversationId,
  callBusy: callBusyProp,
}: GameRequestComposeDialogProps) {
  const t = useTranslations('modules.messenger')
  const tGames = useTranslations('modules.games')
  const catalog = listCatalog()
  const [slug, setSlug] = useState(catalog[0]?.slug ?? 'tic-tac-toe')
  const [pending, startTransition] = useTransition()
  const sharedCallBusy = usePeerCallBusy()
  const callBusy = Boolean(callBusyProp || sharedCallBusy)

  const onSubmit = () => {
    if (callBusy) {
      toast({
        title: t('gameCallBusyTitle'),
        description: t('gameCallBusyCompose'),
        variant: 'destructive',
      })
      return
    }
    startTransition(async () => {
      const result = await createGameRequest({ conversationId, slug })
      if (!result.success) {
        toast({
          title: result.error ?? t('gameChallengeFailed'),
          variant: 'destructive',
        })
        return
      }
      toast({ title: t('gameChallengeSent') })
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('gameComposeTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="game-slug">{t('gameLabel')}</Label>
          <select
            id="game-slug"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={slug}
            onChange={(e) => setSlug(e.target.value as typeof slug)}
          >
            {catalog.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {localizedCatalogTitle(tGames, entry.slug)}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">{t('gameDirectOnlyHint')}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('gameCancel')}
          </Button>
          <Button onClick={onSubmit} disabled={pending || callBusy}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('gameSendChallenge')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
