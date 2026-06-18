/**
 * useEditorUpdates Hook
 * Listens to document-level tunnel events and triggers a reload
 * when a newer document version is detected.
 */

'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { TunnelMessage } from '@/lib/tunnel/types'
import { useSync, UseSyncTunnelAction } from './use-sync'

type UseEditorUpdatesOptions = {
  publicationId?: string | null
  currentVersion?: number | null
  enabled?: boolean
  refreshInterval?: number
  autoRefresh?: boolean
  onRefetch: () => Promise<void> | void
}

type UseEditorUpdatesReturn = {
  data: void | null
  loading: boolean
  error: string | null
  usingTunnel: boolean
  tunnelConnected: boolean
  refresh: () => Promise<void | null>
  clearCache: () => void
  clearError: () => void
}

interface DocumentUpdatePayload {
  event?: string
  documentId?: string
  version?: number | string
}

const getDocumentVersionFromMessage = (payload: unknown): number | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const nextPayload = payload as DocumentUpdatePayload
  const nextVersion = nextPayload.version
  if (typeof nextVersion !== 'number' || Number.isNaN(nextVersion)) {
    if (typeof nextPayload.version === 'string') {
      const parsed = Number(nextPayload.version)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
    return null
  }
  return nextVersion
}

export function useEditorUpdates({
  publicationId,
  currentVersion,
  enabled = true,
  refreshInterval = 180000,
  autoRefresh = true,
  onRefetch
}: UseEditorUpdatesOptions): UseEditorUpdatesReturn {
  const versionRef = useRef<number | null>(currentVersion ?? null)
  const enabledRef = useRef(enabled)

  useEffect(() => {
    versionRef.current = currentVersion ?? null
    enabledRef.current = enabled
  }, [currentVersion, enabled])

  const handleTunnelMessage = useCallback((message: TunnelMessage): UseSyncTunnelAction<void> | void => {
    const incomingVersion = getDocumentVersionFromMessage(message.payload)
    if (!incomingVersion) {
      return { shouldRefetch: true }
    }
    const knownVersion = versionRef.current
    if (knownVersion == null) {
      return { shouldRefetch: true }
    }
    if (incomingVersion > knownVersion) {
      return { shouldRefetch: true }
    }
    return { shouldRefetch: false }
  }, [])

  const sync = useSync<void>({
    enabled: Boolean(enabled && publicationId),
    autoRefresh,
    refreshInterval,
    fetcher: async () => {
      await onRefetch()
      return
    },
    tunnel: {
      channel: publicationId ? `document:${publicationId}` : undefined,
      enabled: Boolean(publicationId && enabledRef.current),
      onMessage: handleTunnelMessage,
    }
  })

  const refresh = useCallback(async () => {
    await sync.refresh()
  }, [sync])

  return {
    ...sync,
    refresh,
    clearError: sync.clearError,
    clearCache: sync.clearCache
  }
}
