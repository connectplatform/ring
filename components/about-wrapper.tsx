'use client'

import React, { Suspense } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import AboutContent from '@/components/pages/about'

/**
 * LoadingFallback component
 * Displays a loading message while the content is being loaded
 * 
 * @returns JSX.Element - The loading fallback UI
 */
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 text-gray-800 dark:text-gray-200 overflow-hidden relative transition-colors duration-300">
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">Loading about Page...</div>
      </div>
    </div>
  )
}

/**
 * AboutWrapperProps interface
 * Defines the props for the AboutWrapper component
 * 
 * @param userAgent - The user agent string from the request headers
 * @param token - The authentication token, if available
 * @param params - The route parameters
 * @param searchParams - The search parameters from the URL
 */
interface AboutWrapperProps {
  userAgent: string | null;
  token: string | undefined;
  params: { slug?: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

/**
 * AboutWrapper component
 * Wraps the AboutContent component and handles session management
 * 
 * @param props - The AboutWrapperProps
 * @returns JSX.Element - The rendered AboutWrapper component
 */
export default function AboutWrapper({ userAgent, token, params, searchParams }: AboutWrapperProps) {
  const { data: session } = useSession()

  // User steps:
  // 1. User navigates to the about page
  // 2. The wrapper component checks for an active session
  // 3. The AboutContent is rendered within a Suspense boundary
  // 4. If content is not immediately available, a loading fallback is shown

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 text-gray-800 dark:text-gray-200 overflow-hidden relative transition-colors duration-300">
      {/* Static links for Google bot */}
      <div style={{position: 'absolute', top: '-9999px', left: '-9999px'}}>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Service</Link>
        <Link href="/">home</Link>
      </div>
      <Suspense fallback={<LoadingFallback />}>
        <AboutContent />
      </Suspense>
      {/* Debug information */}
      <div className="hidden">
        <p>User Agent: {userAgent}</p>
        <p>Token: {token}</p>
        <p>Params: {JSON.stringify(params)}</p>
        <p>Search Params: {JSON.stringify(searchParams)}</p>
      </div>
    </div>
  )
}

