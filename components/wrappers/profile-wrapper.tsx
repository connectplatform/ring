'use client'

import { useSession } from 'next-auth/react'
import { AuthUser } from '@/features/auth/types'
import { ProfileWrapperProps } from '@/types/profile'
import { updateProfile } from '@/app/_actions/profile'
import ProfileContent from '@/features/auth/components/profile-content'
import { useEffect, useMemo, useState } from 'react'

/**
 * LoadingFallback component
 * Displays a loading message while content is being loaded
 */
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse">Loading profile...</div>
    </div>
  )
}

function readTunnelBypass(): boolean {
  if (typeof document === 'undefined') return false
  return (
    document.querySelector('meta[name="x-tunnel-bypass"]')?.getAttribute('content') === 'true' ||
    (window as Window & { __TUNNEL_BYPASS__?: boolean }).__TUNNEL_BYPASS__ === true
  )
}

/**
 * ProfileWrapper component - React 19 modernized with Progressive Tunnel Loading
 * PHASE 1: Implements tunnel timing rearchitecture for GIS auth freeze fix
 */
export default function ProfileWrapper({ initialUser, initialError, params, searchParams }: ProfileWrapperProps) {
  const { data: session, status } = useSession()
  // Default ready unless middleware explicitly deferred tunnel init (avoids false→true flicker).
  const [tunnelReady, setTunnelReady] = useState(() => !readTunnelBypass())

  useEffect(() => {
    if (!readTunnelBypass()) {
      return
    }

    const timer = window.setTimeout(async () => {
      try {
        const { initializeTunnelAfterAuth } = await import('@/lib/tunnel/tunnel-init')
        await initializeTunnelAfterAuth()
      } catch (error) {
        console.error('ProfileWrapper: Tunnel initialization failed:', error)
      } finally {
        setTunnelReady(true)
      }
    }, 100)

    return () => window.clearTimeout(timer)
  }, [])

  // SSR already hydrated the profile — avoid passing volatile session object (prevents widget redraw storms).
  const sessionForContent = useMemo(
    () => (initialUser ? null : session ?? null),
    [initialUser, session],
  )

  if (initialUser) {
    return (
      <ProfileContent
        initialUser={initialUser}
        initialError={initialError}
        params={params}
        searchParams={searchParams}
        session={sessionForContent}
        updateProfile={updateProfile}
        tunnelReady={tunnelReady}
      />
    )
  }

  if (status === 'loading') {
    return <LoadingFallback />
  }

  if (session) {
    return (
      <ProfileContent
        initialUser={null}
        initialError={initialError}
        params={params}
        searchParams={searchParams}
        session={sessionForContent}
        updateProfile={updateProfile}
        tunnelReady={tunnelReady}
      />
    )
  }

  return <div className="text-center py-8">Access Denied. Please sign in to view your profile.</div>
}
