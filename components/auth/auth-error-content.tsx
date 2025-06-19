'use client'

import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ROUTES } from '@/constants/routes'
import { defaultLocale } from '@/utils/i18n-server'

/**
 * AuthErrorContent component
 * Displays authentication error messages and provides navigation options
 * 
 * User steps:
 * 1. User encounters an authentication error
 * 2. Component displays the appropriate error message
 * 3. User can choose to try logging in again or return to the home page
 * 
 * @returns {React.ReactElement} The rendered AuthErrorContent component
 */
export default function AuthErrorContent() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  
  // Determine the error type based on the URL parameter or authentication status
  const error = errorParam || (status === 'unauthenticated' ? 'SignInError' : null)

  /**
   * Get the appropriate error message based on the error type
   * 
   * @param {string | null} errorType - The type of error encountered
   * @returns {string} The corresponding error message
   */
  const getErrorMessage = (errorType: string | null): string => {
    switch (errorType) {
      case 'SignInError':
        return 'There was an error signing in. Please try again.'
      case 'Configuration':
        return 'There is a problem with the server configuration. Please contact support.'
      case 'AccessDenied':
        return 'Access denied. You do not have permission to access this resource.'
      case 'Verification':
        return 'The verification token has expired or has already been used. Please request a new one.'
      default:
        return 'An unknown error occurred. Please try again or contact support.'
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Authentication Error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-destructive text-center">{getErrorMessage(error)}</p>
          <p className="text-muted-foreground text-center">
            If this problem persists, please contact our support team.
          </p>
          <div className="flex justify-center space-x-4">
            <Link href={ROUTES.LOGIN(defaultLocale)}>
              <Button variant="default">
                Try Again
              </Button>
            </Link>
            <Link href={ROUTES.HOME(defaultLocale)}>
              <Button variant="outline">
                Go to home
              </Button>
            </Link>
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Error code: {error || 'UNKNOWN'}
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

