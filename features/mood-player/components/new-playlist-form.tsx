'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createMoodPlaylistAction, type MoodPlayerActionState } from '@/app/_actions/mood-player'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { useLocale } from 'next-intl'

export function NewPlaylistForm() {
  const locale = useLocale()
  const router = useRouter()
  const [visibility, setVisibility] = useState('private')
  const [state, action, pending] = useActionState(
    createMoodPlaylistAction,
    null as MoodPlayerActionState | null
  )

  useEffect(() => {
    if (state?.success && state.playlistId) {
      router.push(ROUTES.PROFILE_PLAYER_PLAYLIST(state.playlistId, locale as 'en'))
    }
  }, [state, router, locale])

  return (
    <form action={action} className="mx-auto max-w-lg space-y-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">New mood playlist</h1>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required placeholder="Healing songs" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>
      <div className="space-y-2">
        <Label>Visibility</Label>
        <Select value={visibility} onValueChange={setVisibility}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="private">Private</SelectItem>
            <SelectItem value="unlisted">Unlisted</SelectItem>
            <SelectItem value="public">Public</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="visibility" value={visibility} />
      </div>
      <label className={`flex items-center gap-2 text-sm ${visibility !== 'public' ? 'text-muted-foreground' : ''}`}>
        <input
          type="checkbox"
          name="isPrimary"
          value="true"
          disabled={visibility !== 'public'}
        />
        Set as primary public playlist
        {visibility !== 'public' ? ' (requires Public)' : ''}
      </label>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create
      </Button>
    </form>
  )
}
