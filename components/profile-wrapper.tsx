'use client'

import { useSession } from 'next-auth/react'
import { AuthUser } from '@/features/auth/types'
import { ProfileWrapperProps } from '@/types/profile'
import { updateProfile } from '@/app/actions/profile'
import ProfileContent from '@/components/auth/profile-content'

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
 * ProfileWrapper component - React 19 modernized
 * Wraps the profile content with session management
 */
export default function ProfileWrapper({ initialUser, initialError, params, searchParams }: ProfileWrapperProps) {
  const { data: session, status } = useSession();

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
      />
    )
  }

  // Only show access denied if neither server nor client session exists
  return <div className="text-center py-8">Access Denied. Please sign in to view your profile.</div>
}

