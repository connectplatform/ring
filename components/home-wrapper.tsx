'use client'

import React, { Suspense } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useTranslation } from '@/node_modules/react-i18next'
import HomeContent from '@/components/pages/home'
import { User } from 'next-auth'

function LoadingFallback() {
  const { t } = useTranslation()
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 text-gray-800 dark:text-gray-200 overflow-hidden relative transition-colors duration-300">
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">{t('loading')}</div>
      </div>
    </div>
  )
}

/**
 * HomeWrapperProps interface
 * @interface HomeWrapperProps
 * @property {string | null} userAgent - The user agent string from the request headers
 * @property {string | undefined} token - The authentication token from cookies
 * @property {{ slug?: string }} params - The route parameters
 * @property {{ [key: string]: string | string[] | undefined }} searchParams - The search parameters from the URL
 * @property {User | undefined} user - The authenticated user object
 */
interface HomeWrapperProps {
  userAgent: string | null;
  token: string | undefined;
  params: { slug?: string };
  searchParams: { [key: string]: string | string[] | undefined };
  user: User | undefined;
}

/**
 * HomeWrapper component
 * This component wraps the main content of the home page and handles session management.
 * 
 * User steps:
 * 1. The component is rendered with props from the server
 * 2. It checks for an active session using useSession hook
 * 3. The main content is rendered within a Suspense boundary for smooth loading
 * 4. Additional data (userAgent, token, params, searchParams) is available for potential use
 * 
 * @param {HomeWrapperProps} props - The component props
 * @returns {JSX.Element} The rendered HomeWrapper component
 */
export default function HomeWrapper({ userAgent, token, params, searchParams, user }: HomeWrapperProps) {
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 text-gray-800 dark:text-gray-200 overflow-hidden relative transition-colors duration-300">
      {/* Static links for Google bot */}
      <div style={{position: 'absolute', top: '-9999px', left: '-9999px'}}>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Service</Link>
      </div>
      <Suspense fallback={<LoadingFallback />}>
        <HomeContent session={session} />
      </Suspense>
      {/* Example usage of new async data */}
      <div className="hidden">
        <p>User Agent: {userAgent}</p>
        <p>Token: {token}</p>
        <p>Params: {JSON.stringify(params)}</p>
        <p>Search Params: {JSON.stringify(searchParams)}</p>
        <p>User: {JSON.stringify(user)}</p>
      </div>
    </div>
  )
}

