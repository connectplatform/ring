'use client' // Error boundaries must be Client Components

import React from 'react'
import { Button } from "@/components/ui/button"

/**
 * Error Component
 * 
 * This component is used to handle unexpected runtime errors and display fallback UI.
 * It wraps a route segment and its nested children in a React Error Boundary.
 * 
 * @component
 * @param {Object} props - The properties passed to the component
 * @param {Error & { digest?: string }} props.error - An instance of an Error object forwarded to the error.js Client Component
 * @param {() => void} props.reset - A function to attempt recovery by re-rendering the error boundary's contents
 * 
 * User Steps:
 * 1. This component is automatically invoked when an error occurs within its boundary
 * 2. Users can click the "Try again" button to attempt to recover from the error
 * 
 * Developer Notes:
 * - Ensure this file is placed in the appropriate route segment directory
 * - The 'use client' directive is required as Error boundaries must be Client Components
 * - Consider adding more detailed error logging or connecting to an error reporting service
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Log the error when the component mounts
  React.useEffect(() => {
    // Log the error to an error reporting service
    console.error('Error occurred:', error)
    
    // TODO: Implement a more robust error logging mechanism
    // For example, sending the error to a backend API or a service like Sentry
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <div className="max-w-md w-full p-6 bg-card rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-center">Oops! Something went wrong</h2>
        <p className="text-muted-foreground mb-6 text-center">
          We apologize for the inconvenience. Our team has been notified and is working on a fix.
        </p>
        {/* Display the error digest if available */}
        {error.digest && (
          <p className="text-sm text-muted-foreground mb-4 text-center">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex justify-center">
          <Button
            variant="default"
            onClick={() => reset()}
            className="w-full"
            aria-label="Try again"
          >
            Try again
          </Button>
        </div>
      </div>
    </div>
  )
}

