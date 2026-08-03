'use client'

import React, { useActionState, useEffect, useState, useTransition } from 'react'
import { ChevronDown, ChevronUp, Loader2, Plus, Sparkles, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { MoodPlaylist, MoodVariant, PlaylistSong } from '@/features/mood-player/schemas'
import {
  generateMoodTrackAction,
  saveMoodPlaylistAction,
  type MoodPlayerActionState,
} from '@/app/_actions/mood-player'

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

async function uploadMoodFile(
  file: File,
  playlistId: string,
  trackKey: string
): Promise<{ url: string; fileId?: string }> {
  const body = new FormData()
  body.append('file', file)
  body.append('purpose', 'mood:track')
  body.append('productId', playlistId)
  body.append('fileCategory', trackKey)
  const res = await fetch('/api/uploads', { method: 'POST', body })
  const json = await res.json()
  if (!res.ok || !json.success || !json.url) {
    throw new Error(json.error || 'Upload failed')
  }
  return { url: json.url as string, fileId: json.fileId as string | undefined }
}

type PlaylistEditorProps = {
  playlist: MoodPlaylist
  onSaved?: () => void
}

export function PlaylistEditor({ playlist, onSaved }: PlaylistEditorProps) {
  const [title, setTitle] = useState(playlist.title)
  const [description, setDescription] = useState(playlist.description || '')
  const [visibility, setVisibility] = useState(playlist.visibility)
  const [isPrimary, setIsPrimary] = useState(Boolean(playlist.isPrimary))
  const [songs, setSongs] = useState<PlaylistSong[]>(playlist.songs || [])
  const [openMoods, setOpenMoods] = useState<Record<string, boolean>>({})
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [saveState, saveAction, savePending] = useActionState(
    saveMoodPlaylistAction,
    null as MoodPlayerActionState | null
  )
  const [genState, genAction, genPending] = useActionState(
    generateMoodTrackAction,
    null as MoodPlayerActionState | null
  )

  useEffect(() => {
    if (!genState?.success || !genState.url) return
    const songId = genState.songId
    const moodId = genState.moodId
    if (!songId) return
    setSongs((prev) =>
      prev.map((s) => {
        if (s.id !== songId) return s
        if (moodId) {
          return {
            ...s,
            moods: (s.moods || []).map((m) =>
              m.id === moodId
                ? {
                    ...m,
                    fileUrl: genState.url!,
                    fileId: genState.fileId,
                    meta: { ...(m.meta || {}), source: 'generated' as const, provider: 'suno' },
                  }
                : m
            ),
          }
        }
        return {
          ...s,
          fileUrl: genState.url!,
          fileId: genState.fileId,
          meta: { ...s.meta, source: 'generated' as const, provider: 'suno' },
        }
      })
    )
  }, [genState])

  useEffect(() => {
    if (saveState?.success) onSaved?.()
  }, [saveState?.success, onSaved])

  useEffect(() => {
    setTitle(playlist.title)
    setDescription(playlist.description || '')
    setVisibility(playlist.visibility)
    setIsPrimary(Boolean(playlist.isPrimary))
    setSongs(playlist.songs || [])
  }, [playlist.id, playlist.updatedAt])

  const runGenerate = (opts: {
    songId: string
    moodId?: string
    lyrics: string
    style: string
    title: string
  }) => {
    const fd = new FormData()
    fd.set('playlistId', playlist.id)
    fd.set('songId', opts.songId)
    if (opts.moodId) fd.set('moodId', opts.moodId)
    fd.set('lyrics', opts.lyrics)
    fd.set('style', opts.style)
    fd.set('title', opts.title)
    startTransition(() => {
      genAction(fd)
    })
  }

  const updateSong = (songId: string, patch: Partial<PlaylistSong>) => {
    setSongs((prev) => prev.map((s) => (s.id === songId ? { ...s, ...patch } : s)))
  }

  const updateSongMeta = (songId: string, metaPatch: Partial<PlaylistSong['meta']>) => {
    setSongs((prev) =>
      prev.map((s) => (s.id === songId ? { ...s, meta: { ...s.meta, ...metaPatch } } : s))
    )
  }

  const addSong = () => {
    setSongs((prev) => {
      const song: PlaylistSong = {
        id: newId(),
        fileUrl: '',
        meta: { title: `Song ${prev.length + 1}`, source: 'upload' },
        moods: [],
      }
      return [...prev, song]
    })
  }

  const removeSong = (songId: string) => {
    setSongs((prev) => prev.filter((s) => s.id !== songId))
  }

  const moveSong = (index: number, delta: number) => {
    setSongs((prev) => {
      const next = [...prev]
      const j = index + delta
      if (j < 0 || j >= next.length) return prev
      const tmp = next[index]
      next[index] = next[j]
      next[j] = tmp
      return next
    })
  }

  const addMood = (songId: string) => {
    const mood: MoodVariant = {
      id: newId(),
      moodName: 'New mood',
      fileUrl: '',
      meta: { source: 'upload' },
    }
    setSongs((prev) =>
      prev.map((s) =>
        s.id === songId ? { ...s, moods: [...(s.moods || []), mood] } : s
      )
    )
    setOpenMoods((m) => ({ ...m, [songId]: true }))
  }

  const updateMood = (songId: string, moodId: string, patch: Partial<MoodVariant>) => {
    setSongs((prev) =>
      prev.map((s) => {
        if (s.id !== songId) return s
        return {
          ...s,
          moods: (s.moods || []).map((m) => (m.id === moodId ? { ...m, ...patch } : m)),
        }
      })
    )
  }

  const removeMood = (songId: string, moodId: string) => {
    setSongs((prev) =>
      prev.map((s) =>
        s.id === songId
          ? { ...s, moods: (s.moods || []).filter((m) => m.id !== moodId) }
          : s
      )
    )
  }

  const onUploadRoot = (songId: string, file: File | null) => {
    if (!file) return
    setUploadError(null)
    startTransition(async () => {
      try {
        const up = await uploadMoodFile(file, playlist.id, songId)
        setSongs((prev) =>
          prev.map((s) =>
            s.id === songId
              ? {
                  ...s,
                  fileUrl: up.url,
                  fileId: up.fileId,
                  meta: { ...s.meta, source: 'upload' as const },
                }
              : s
          )
        )
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : 'Upload failed')
      }
    })
  }

  const onUploadMood = (songId: string, moodId: string, file: File | null) => {
    if (!file) return
    setUploadError(null)
    startTransition(async () => {
      try {
        const up = await uploadMoodFile(file, playlist.id, `${songId}-${moodId}`)
        setSongs((prev) =>
          prev.map((s) => {
            if (s.id !== songId) return s
            return {
              ...s,
              moods: (s.moods || []).map((m) =>
                m.id === moodId
                  ? {
                      ...m,
                      fileUrl: up.url,
                      fileId: up.fileId,
                      meta: { ...(m.meta || {}), source: 'upload' as const },
                    }
                  : m
              ),
            }
          })
        )
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : 'Upload failed')
      }
    })
  }

  return (
    <div className="space-y-6">
      {(saveState?.error || genState?.error || uploadError || genState?.billWarning) && (
        <Alert variant={genState?.billWarning && !genState?.error ? 'default' : 'destructive'}>
          <AlertDescription>
            {saveState?.error || genState?.error || uploadError || genState?.billWarning}
          </AlertDescription>
        </Alert>
      )}
      {saveState?.success && (
        <Alert>
          <AlertDescription>Playlist saved.</AlertDescription>
        </Alert>
      )}
      {genState?.success && genState.url && (
        <Alert>
          <AlertDescription>Generated track applied to the song/mood cell.</AlertDescription>
        </Alert>
      )}

      <form action={saveAction} className="space-y-4">
        <input type="hidden" name="playlistId" value={playlist.id} />
        <input type="hidden" name="songsJson" value={JSON.stringify(songs)} />
        <input type="hidden" name="isPrimary" value={isPrimary && visibility === 'public' ? 'true' : 'false'} />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as MoodPlaylist['visibility'])}>
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={isPrimary && visibility === 'public'}
            onCheckedChange={setIsPrimary}
            id="isPrimary"
            disabled={visibility !== 'public'}
          />
          <Label htmlFor="isPrimary" className={visibility !== 'public' ? 'text-muted-foreground' : undefined}>
            Primary public playlist for /[username]/player
            {visibility !== 'public' ? ' (requires Public visibility)' : ''}
          </Label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Songs</h3>
            <Button type="button" variant="outline" size="sm" onClick={addSong} className="gap-1">
              <Plus className="h-4 w-4" /> Add song
            </Button>
          </div>

          {songs.length === 0 && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Add your first song — then expand Moods for optional arrangements of the same lyrics.
            </p>
          )}

          {songs.map((song, index) => (
            <div key={song.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex flex-col gap-1">
                  <Button type="button" size="icon" variant="ghost" onClick={() => moveSong(index, -1)} disabled={index === 0}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => moveSong(index, 1)}
                    disabled={index === songs.length - 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Title</Label>
                      <Input
                        value={song.meta.title}
                        onChange={(e) => updateSongMeta(song.id, { title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Author</Label>
                      <Input
                        value={song.meta.author || ''}
                        onChange={(e) => updateSongMeta(song.id, { author: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Year</Label>
                      <Input
                        value={song.meta.year?.toString() || ''}
                        onChange={(e) => updateSongMeta(song.id, { year: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Cover URL</Label>
                      <Input
                        value={song.meta.coverUrl || ''}
                        onChange={(e) => updateSongMeta(song.id, { coverUrl: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Lyrics (shared across moods)</Label>
                    <Textarea
                      value={song.meta.lyrics || ''}
                      onChange={(e) => updateSongMeta(song.id, { lyrics: e.target.value })}
                      rows={4}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Root audio</Label>
                    <Input
                      className="max-w-md"
                      value={song.fileUrl}
                      onChange={(e) => updateSong(song.id, { fileUrl: e.target.value })}
                      placeholder="file URL after upload"
                    />
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-2 text-sm">
                      <Upload className="h-3.5 w-3.5" />
                      Upload
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => onUploadRoot(song.id, e.target.files?.[0] || null)}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={genPending || pending || !song.meta.lyrics}
                      className="gap-1"
                      onClick={() =>
                        runGenerate({
                          songId: song.id,
                          lyrics: song.meta.lyrics || '',
                          style: 'healing, emotional, cinematic',
                          title: song.meta.title,
                        })
                      }
                    >
                      {genPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Generate
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled
                      title="TODO: import track from URL into ring-filebase"
                    >
                      Import URL (soon)
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeSong(song.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <Collapsible
                    open={Boolean(openMoods[song.id])}
                    onOpenChange={(open) => setOpenMoods((m) => ({ ...m, [song.id]: open }))}
                  >
                    <div className="flex items-center gap-2">
                      <CollapsibleTrigger asChild>
                        <Button type="button" variant="outline" size="sm">
                          Moods ({song.moods?.length || 0})
                        </Button>
                      </CollapsibleTrigger>
                      <Button type="button" variant="ghost" size="sm" onClick={() => addMood(song.id)}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add mood
                      </Button>
                    </div>
                    <CollapsibleContent className="mt-3 space-y-3">
                      {(song.moods || []).map((mood) => (
                        <div key={mood.id} className="rounded-lg border border-dashed bg-muted/30 p-3 space-y-2">
                          <div className="grid gap-2 md:grid-cols-2">
                            <div className="space-y-1">
                              <Label>Mood name</Label>
                              <Input
                                value={mood.moodName}
                                onChange={(e) => updateMood(song.id, mood.id, { moodName: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Audio URL</Label>
                              <Input
                                value={mood.fileUrl}
                                onChange={(e) => updateMood(song.id, mood.id, { fileUrl: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-2 text-sm">
                              <Upload className="h-3.5 w-3.5" />
                              Upload
                              <input
                                type="file"
                                accept="audio/*"
                                className="hidden"
                                onChange={(e) =>
                                  onUploadMood(song.id, mood.id, e.target.files?.[0] || null)
                                }
                              />
                            </label>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={genPending || pending || !song.meta.lyrics}
                              className="gap-1"
                              onClick={() =>
                                runGenerate({
                                  songId: song.id,
                                  moodId: mood.id,
                                  lyrics: song.meta.lyrics || '',
                                  style: mood.moodName,
                                  title: `${song.meta.title} — ${mood.moodName}`,
                                })
                              }
                            >
                              <Sparkles className="h-3.5 w-3.5" /> Generate
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeMood(song.id, mood.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={savePending || pending}>
            {(savePending || pending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save playlist
          </Button>
        </div>
      </form>
    </div>
  )
}
