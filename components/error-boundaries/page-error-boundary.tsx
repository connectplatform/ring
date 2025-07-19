'use client'

import { ErrorBoundary } from 'react-error-boundary'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Home, ArrowLeft, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface PageErrorBoundaryProps {
  children: React.ReactNode
  pageName?: string
  showNavigation?: boolean
  /** Client-side error callback - not a Server Action */
  onError?: (error: Error, errorInfo: any) => void
}

export function PageErrorBoundary({ 
  children, 
  pageName = 'Page',
  showNavigation = true,
  onError 
}: PageErrorBoundaryProps) {
  const router = useRouter()

  const handleGoHome = () => {
    router.push('/')
  }

  const handleGoBack = () => {
    router.back()
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  // Client-side error handler - not a Server Action
  const handleError = (error: Error, errorInfo: any) => {
    console.error(`Error in ${pageName}:`, error, errorInfo)
    
    // Call optional callback if provided
    if (onError) {
      onError(error, errorInfo)
    }

    // Report to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Replace with your error tracking service
      // reportError(error, { page: pageName, ...errorInfo })
    }
  }

  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-12 w-12 text-red-500" />
          </div>
          <CardTitle className="text-xl">
            Something went wrong
          </CardTitle>
          <CardDescription>
            An error occurred while loading {pageName.toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              {error.message || 'An unexpected error occurred'}
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <Button 
              onClick={resetErrorBoundary} 
              className="w-full"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            
            {showNavigation && (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleRefresh}
                  className="w-full"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Refresh Page
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={handleGoBack}
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go Back
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={handleGoHome}
                  className="w-full"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onError={handleError}
    >
      {children}
    </ErrorBoundary>
  )
} 