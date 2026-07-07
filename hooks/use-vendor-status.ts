'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface VendorStatusResult {
  hasVendor: boolean
}

/** Mirrors DeviceTelemetryProvider's coalescing window (lib/analytics/device-context.ts convention). */
const CACHE_TTL_MS = 30_000

let cachedUserId: string | null = null
let cachedResult: VendorStatusResult | null = null
let cachedAt = 0
let inFlight: Promise<VendorStatusResult> | null = null
let inFlightUserId: string | null = null

/**
 * Single-flight, short-TTL fetch of `/api/vendor/status`.
 * Dedupes concurrent callers (Strict Mode double-mount, sidebar breakpoint swap
 * between SidebarSyncedLayout and SidebarAside) to one network request per userId.
 */
async function fetchVendorStatus(userId: string): Promise<VendorStatusResult> {
  const now = Date.now()
  if (cachedUserId === userId && cachedResult && now - cachedAt < CACHE_TTL_MS) {
    return cachedResult
  }

  if (inFlight && inFlightUserId === userId) {
    return inFlight
  }

  inFlightUserId = userId
  inFlight = (async () => {
    try {
      const res = await fetch('/api/vendor/status')
      const data = res.ok ? await res.json().catch(() => null) : null
      const result: VendorStatusResult = { hasVendor: Boolean(data?.hasVendor) }
      cachedUserId = userId
      cachedResult = result
      cachedAt = Date.now()
      return result
    } catch {
      return { hasVendor: false }
    } finally {
      inFlight = null
      inFlightUserId = null
    }
  })()

  return inFlight
}

/**
 * Vendor status SSOT — one-shot read, not a tunnel subscription, so no provider/context
 * is required per hooks/HOOKS-README.md Provider matrix rule. Replaces the duplicate
 * inline `fetch('/api/vendor/status')` effects previously in sidebar-synced-layout.tsx
 * and sidebar-aside.tsx.
 */
export function useVendorStatus(): VendorStatusResult {
  const { data: session } = useSession()
  const userId = session?.user?.id
  const [hasVendor, setHasVendor] = useState(false)

  useEffect(() => {
    if (!userId) {
      setHasVendor(false)
      return
    }

    let cancelled = false
    void fetchVendorStatus(userId).then((result) => {
      if (!cancelled) setHasVendor(result.hasVendor)
    })

    return () => {
      cancelled = true
    }
  }, [userId])

  return { hasVendor }
}
