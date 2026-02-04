'use client'

import { useSession } from 'next-auth/react'
import { AuthUser } from '@/features/auth/types'
import { ProfileWrapperProps } from '@/types/profile'
import { updateProfile } from '@/app/_actions/profile'
import ProfileContent from '@/features/auth/components/profile-content'
import { useEffect, useState } from 'react'

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

/**
 * ProfileWrapper component - React 19 modernized with Progressive Tunnel Loading
 * PHASE 1: Implements tunnel timing rearchitecture for GIS auth freeze fix
 */
export default function ProfileWrapper({ initialUser, initialError, params, searchParams }: ProfileWrapperProps) {
  const { data: session, status } = useSession();
  const [tunnelReady, setTunnelReady] = useState(false);

  // PHASE 1: PROGRESSIVE TUNNEL LOADING
  // Check if middleware bypassed tunnel initialization for auth-critical route
  useEffect(() => {
    const checkTunnelBypass = async () => {
      try {
        // Check for tunnel bypass header from middleware
        const bypassHeader = document.querySelector('meta[name="x-tunnel-bypass"]')?.getAttribute('content') ||
                           (window as any).__TUNNEL_BYPASS__;

        if (bypassHeader === 'true') {
          console.log('ProfileWrapper: Tunnel bypass detected - establishing tunnel after auth confirmation');

          // Small delay to ensure page is fully loaded before tunnel init
          setTimeout(async () => {
            try {
              // Dynamically import tunnel initialization to avoid blocking initial render
              const { initializeTunnelAfterAuth } = await import('@/lib/tunnel/tunnel-init');
              await initializeTunnelAfterAuth();
              setTunnelReady(true);
              console.log('ProfileWrapper: Tunnel established successfully after auth');
            } catch (error) {
              console.error('ProfileWrapper: Tunnel initialization failed:', error);
              // Continue without tunnel - graceful degradation
              setTunnelReady(true);
            }
          }, 100);
        } else {
          // Normal tunnel initialization for non-auth routes
          setTunnelReady(true);
        }
      } catch (error) {
        console.error('ProfileWrapper: Error checking tunnel bypass:', error);
        // Continue with normal flow
        setTunnelReady(true);
      }
    };

    checkTunnelBypass();
  }, []);

  // If we have initialUser from server-side auth, show profile immediately
  // Don't wait for client-side session loading when server has already authenticated
  if (initialUser) {
    return (
      <ProfileContent
        initialUser={initialUser}
        initialError={initialError}
        params={params}
        searchParams={searchParams}
        session={session}
        updateProfile={updateProfile}
        tunnelReady={tunnelReady}
      />
    )
  }

  // Show loading only while session is actually loading and we don't have server-side data
  if (status === 'loading') {
    return <LoadingFallback />
  }

  // If client-side session exists but no server-side initialUser
  if (session) {
    return (
      <ProfileContent
        initialUser={null}
        initialError={initialError}
        params={params}
        searchParams={searchParams}
        session={session}
        updateProfile={updateProfile}
        tunnelReady={tunnelReady}
      />
    )
  }

  // Only show access denied if neither server nor client session exists
  return <div className="text-center py-8">Access Denied. Please sign in to view your profile.</div>
}

