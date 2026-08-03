'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { updateEnabledGamesAction } from '@/app/_actions/peer-games'
import { toast } from '@/hooks/use-toast'
import {
  localizedCatalogDescription,
  localizedCatalogTitle,
} from '../lib/catalog-i18n'
import type { PeerGameSlug } from '../types'

export function ProfileGamesManager({
  catalog,
  initialEnabled,
}: {
  catalog: Array<{ slug: PeerGameSlug | string; title: string; description: string }>
  initialEnabled: string[]
}) {
  const tGames = useTranslations('modules.games')
  const [enabled, setEnabled] = useState<string[]>(initialEnabled)
  const [pending, startTransition] = useTransition()

  const toggle = (slug: string, on: boolean) => {
    setEnabled((prev) =>
      on ? Array.from(new Set([...prev, slug])) : prev.filter((s) => s !== slug),
    )
  }

  const onSave = () => {
    startTransition(async () => {
      const result = await updateEnabledGamesAction({ enabledSlugs: enabled })
      if (!result.success) {
        toast({ title: result.error ?? 'Save failed', variant: 'destructive' })
        return
      }
      toast({ title: 'Availability saved' })
      if (result.enabledSlugs) setEnabled(result.enabledSlugs)
    })
  }

  return (
    <div className="space-y-4">
      {catalog.map((entry) => (
        <div
          key={entry.slug}
          className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-4"
        >
          <div className="space-y-1">
            <Label htmlFor={`game-${entry.slug}`} className="text-base font-medium">
              {localizedCatalogTitle(tGames, entry.slug)}
            </Label>
            <p className="text-sm text-muted-foreground">
              {localizedCatalogDescription(tGames, entry.slug)}
            </p>
          </div>
          <Switch
            id={`game-${entry.slug}`}
            checked={enabled.includes(entry.slug)}
            onCheckedChange={(on) => toggle(entry.slug, on)}
            disabled={pending}
          />
        </div>
      ))}
      <Button onClick={onSave} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
      </Button>
    </div>
  )
}
