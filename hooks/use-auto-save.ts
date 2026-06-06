'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseAutoSaveOptions {
  /** Debounce delay in ms. Default 30000 (30s). */
  delayMs?: number
  /** When true, skip auto-save (e.g. no auth). */
  disabled?: boolean
  /** Called when a save completes and a new publication was created (first save). */
  onFirstSave?: (publicationId: string) => void
}

export interface UseAutoSavePayload {
  title: string
  content: Record<string, unknown>
  status?: string
}

export interface UseAutoSaveResult {
  /** Trigger a save (POST if no id, PUT if id). Returns the publication id after save. */
  save: (publicationId: string | null, payload: UseAutoSavePayload) => Promise<string | null>
  isSaving: boolean
  lastSaved: Date | null
  lastError: string | null
  /** Call this when content/title change so auto-save can debounce. */
  touch: (publicationId: string | null, payload: UseAutoSavePayload) => void
}

export function useAutoSave(options: UseAutoSaveOptions = {}): UseAutoSaveResult {
  const { delayMs = 30000, disabled = false, onFirstSave } = options
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<{ publicationId: string | null; payload: UseAutoSavePayload } | null>(null)

  const performSave = useCallback(
    async (publicationId: string | null, payload: UseAutoSavePayload): Promise<string | null> => {
      if (disabled) return null
      setIsSaving(true)
      setLastError(null)
      try {
        const isCreate = !publicationId
        const url = isCreate ? '/api/publications' : `/api/publications/${publicationId}`
        const method = isCreate ? 'POST' : 'PUT'
        const body = JSON.stringify({
          title: payload.title,
          content: payload.content,
          status: payload.status ?? 'draft'
        })
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || res.statusText)
        }
        const json = await res.json().catch(() => ({}))
        const id = json?.data?.id ?? (isCreate ? json?.data?.id : publicationId)
        setLastSaved(new Date())
        if (isCreate && id && onFirstSave) {
          onFirstSave(id)
        }
        return id ?? publicationId
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Save failed'
        setLastError(message)
        return null
      } finally {
        setIsSaving(false)
      }
    },
    [disabled, onFirstSave]
  )

  const save = useCallback(
    async (publicationId: string | null, payload: UseAutoSavePayload) => {
      return performSave(publicationId, payload)
    },
    [performSave]
  )

  const touch = useCallback(
    (publicationId: string | null, payload: UseAutoSavePayload) => {
      if (disabled) return
      pendingRef.current = { publicationId, payload }
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        const pending = pendingRef.current
        pendingRef.current = null
        if (pending) performSave(pending.publicationId, pending.payload)
      }, delayMs)
    },
    [disabled, delayMs, performSave]
  )

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return { save, isSaving, lastSaved, lastError, touch }
}
