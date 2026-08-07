'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'

export type AdminSupermenuCloseOptions = {
  /** When true (default for Escape/X), restore focus to the Admin toggle. */
  restoreFocus?: boolean
}

type AdminSupermenuContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  close: (options?: AdminSupermenuCloseOptions) => void
  toggleRef: RefObject<HTMLButtonElement | null>
}

const AdminSupermenuContext = createContext<AdminSupermenuContextValue | null>(null)

export function AdminSupermenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement | null>(null)
  const toggle = useCallback(() => setOpen((v) => !v), [])
  const close = useCallback((options?: AdminSupermenuCloseOptions) => {
    setOpen(false)
    if (options?.restoreFocus !== false) {
      // Defer until after unmount paint so focus lands on the still-mounted toggle.
      window.requestAnimationFrame(() => {
        toggleRef.current?.focus()
      })
    }
  }, [])
  const value = useMemo(
    () => ({ open, setOpen, toggle, close, toggleRef }),
    [open, toggle, close],
  )
  return (
    <AdminSupermenuContext.Provider value={value}>{children}</AdminSupermenuContext.Provider>
  )
}

export function useAdminSupermenuState() {
  const ctx = useContext(AdminSupermenuContext)
  if (!ctx) {
    throw new Error('useAdminSupermenuState must be used within AdminSupermenuProvider')
  }
  return ctx
}

/** Optional consumer — returns null when provider is absent (e.g. tests). */
export function useOptionalAdminSupermenuState(): AdminSupermenuContextValue | null {
  return useContext(AdminSupermenuContext)
}
