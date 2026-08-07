'use client'

/**
 * Global "Use this media" target — TipTap / field surfaces register while focused.
 * Modal Prefer: onUseImage ?? activeTarget.replace
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'

export type MediaUsePayload = {
  kind: 'image' | 'video'
  url: string
  fileId?: string
  alt?: string
  webpUrl?: string
}

export type MediaUseTarget = {
  id: string
  replace: (payload: MediaUsePayload) => void
}

type MediaUseTargetContextValue = {
  activeTarget: MediaUseTarget | null
  register: (target: MediaUseTarget) => void
  unregister: (id: string) => void
}

const MediaUseTargetContext = createContext<MediaUseTargetContextValue | null>(null)

export function MediaUseTargetProvider({ children }: { children: React.ReactNode }) {
  const [activeTarget, setActiveTarget] = useState<MediaUseTarget | null>(null)
  const stackRef = useRef<MediaUseTarget[]>([])

  const register = useCallback((target: MediaUseTarget) => {
    stackRef.current = [...stackRef.current.filter((t) => t.id !== target.id), target]
    setActiveTarget(target)
  }, [])

  const unregister = useCallback((id: string) => {
    stackRef.current = stackRef.current.filter((t) => t.id !== id)
    const next = stackRef.current[stackRef.current.length - 1] || null
    setActiveTarget(next)
  }, [])

  const value = useMemo(
    () => ({ activeTarget, register, unregister }),
    [activeTarget, register, unregister],
  )

  return (
    <MediaUseTargetContext.Provider value={value}>{children}</MediaUseTargetContext.Provider>
  )
}

export function useMediaUseTarget() {
  const ctx = useContext(MediaUseTargetContext)
  if (!ctx) {
    return {
      activeTarget: null as MediaUseTarget | null,
      register: (_target: MediaUseTarget) => {},
      unregister: (_id: string) => {},
    }
  }
  return ctx
}
