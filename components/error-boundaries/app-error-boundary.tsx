'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, AlertTriangle, Bug, ExternalLink, Copy, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  enableReporting?: boolean
  showErrorDetails?: boolean
  level?: 'app' | 'page' | 'component'
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
  isExpanded: boolean
  isCopied: boolean
  retryCount: number
}

export class AppErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null
  private maxRetries = 3

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      isExpanded: false,
      isCopied: false,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate unique error ID for tracking
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    return {
      hasError: true,
      error,
      errorId
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })

    // Enhanced error logging with ES2022 Error.cause
    const enhancedError = this.enhanceError(error, errorInfo)
    
    // Log error with full cause chain
    console.error('🔴 Error Boundary Caught Error:', enhancedError)
    this.logErrorCauseChain(enhancedError)

    // Call custom error handler
    this.props.onError?.(enhancedError, errorInfo)

    // Report error to monitoring service
    if (this.props.enableReporting) {
      this.reportError(enhancedError, errorInfo)
    }
  }

  private enhanceError(error: Error, errorInfo: ErrorInfo): Error {
    // Create enhanced error with ES2022 Error.cause
    const enhancedError = new Error(
      `${this.props.level || 'Component'} Error: ${error.message}`,
      { cause: error }
    )

    // Add additional context
    enhancedError.name = 'ReactErrorBoundaryError'
    
    // Add error boundary context
    ;(enhancedError as any).errorBoundaryContext = {
      level: this.props.level || 'component',
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator?.userAgent,
      url: window?.location?.href,
      componentStack: errorInfo.componentStack,
      errorInfo
    }

    return enhancedError
  }

  private logErrorCauseChain(error: Error, depth = 0) {
    const indent = '  '.repeat(depth)
    console.error(`${indent}${depth === 0 ? '🔴' : '↳'} ${error.name}: ${error.message}`)
    
    if (error.cause instanceof Error) {
      console.error(`${indent}  📍 Caused by:`)
      this.logErrorCauseChain(error.cause, depth + 1)
    }
  }

  private async reportError(error: Error, errorInfo: ErrorInfo) {
    try {
      // Report to monitoring service (e.g., Sentry, LogRocket, etc.)
      const errorReport = {
        errorId: this.state.errorId,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
        componentStack: errorInfo.componentStack,
        level: this.props.level,
        timestamp: new Date().toISOString(),
        userAgent: navigator?.userAgent,
        url: window?.location?.href,
        userId: this.getCurrentUserId(),
        sessionId: this.getSessionId()
      }

      // Send to error reporting service
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorReport)
      })

      console.log('✅ Error reported successfully:', this.state.errorId)
    } catch (reportingError) {
      console.error('❌ Failed to report error:', reportingError)
    }
  }

  private getCurrentUserId(): string | null {
    // Get current user ID from auth context or session
    return null // Implement based on your auth system
  }

  private getSessionId(): string | null {
    // Get current session ID
    return sessionStorage.getItem('sessionId') || null
  }

  private handleRetry = () => {
    const { retryCount } = this.state
    
    if (retryCount >= this.maxRetries) {
      console.warn('Maximum retry attempts reached')
      return
    }

    this.setState(prevState => ({
      retryCount: prevState.retryCount + 1,
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      isExpanded: false
    }))

    // Reset retry count after successful render
    this.retryTimeoutId = setTimeout(() => {
      this.setState({ retryCount: 0 })
    }, 10000) // Reset after 10 seconds
  }

  private handleRefresh = () => {
    window.location.reload()
  }

  private handleToggleExpanded = () => {
    this.setState(prevState => ({
      isExpanded: !prevState.isExpanded
    }))
  }

  private handleCopyError = async () => {
    if (!this.state.error) return

    const errorText = this.formatErrorForCopy()
    
    try {
      await navigator.clipboard.writeText(errorText)
      this.setState({ isCopied: true })
      setTimeout(() => this.setState({ isCopied: false }), 2000)
    } catch (err) {
      console.error('Failed to copy error:', err)
    }
  }

  private formatErrorForCopy(): string {
    const { error, errorInfo, errorId } = this.state
    if (!error) return ''

    return `Error ID: ${errorId}
Error: ${error.name}: ${error.message}
Stack: ${error.stack}
Component Stack: ${errorInfo?.componentStack}
Timestamp: ${new Date().toISOString()}
URL: ${window?.location?.href}
User Agent: ${navigator?.userAgent}
${error.cause ? `\nCaused by: ${error.cause}` : ''}`
  }

  private getErrorSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    const { error } = this.state
    if (!error) return 'low'

    // Determine severity based on error type and context
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      return 'medium'
    }
    if (error.name === 'NetworkError' || error.message.includes('fetch')) {
      return 'medium'
    }
    if (this.props.level === 'app') {
      return 'critical'
    }
    if (this.props.level === 'page') {
      return 'high'
    }
    return 'medium'
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white'
      case 'high': return 'bg-orange-500 text-white'
      case 'medium': return 'bg-yellow-500 text-black'
      case 'low': return 'bg-blue-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      const severity = this.getErrorSeverity()
      const { error, errorInfo, errorId, isExpanded, isCopied, retryCount } = this.state
      const canRetry = retryCount < this.maxRetries

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" data-testid="error-boundary">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl w-full"
          >
            <Card className="shadow-xl border-red-200">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                  <div className="flex-1">
                    <CardTitle className="text-red-700">
                      {this.props.level === 'app' ? 'Application Error' : 
                       this.props.level === 'page' ? 'Page Error' : 'Component Error'}
                    </CardTitle>
                    <CardDescription className="text-red-600">
                      Something went wrong. We're working to fix this issue.
                    </CardDescription>
                  </div>
                  <Badge className={`${this.getSeverityColor(severity)} text-xs`}>
                    {severity.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <Alert>
                  <Bug className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Error ID:</strong> {errorId}
                    <br />
                    <strong>Message:</strong> {error?.message || 'Unknown error occurred'}
                    {retryCount > 0 && (
                      <>
                        <br />
                        <strong>Retry Attempts:</strong> {retryCount}/{this.maxRetries}
                      </>
                    )}
                  </AlertDescription>
                </Alert>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {canRetry && (
                    <Button onClick={this.handleRetry} variant="default" className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Try Again
                    </Button>
                  )}
                  
                  <Button onClick={this.handleRefresh} variant="outline" className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refresh Page
                  </Button>
                  
                  <Button onClick={this.handleCopyError} variant="outline" className="flex items-center gap-2">
                    <Copy className="h-4 w-4" />
                    {isCopied ? 'Copied!' : 'Copy Error'}
                  </Button>
                  
                  <Button onClick={this.handleToggleExpanded} variant="ghost" className="flex items-center gap-2">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {isExpanded ? 'Hide' : 'Show'} Details
                  </Button>
                </div>

                {/* Expandable Error Details */}
                <AnimatePresence>
                  {isExpanded && (this.props.showErrorDetails || process.env.NODE_ENV === 'development') && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4 border-t pt-4"
                    >
                      {/* Error Stack */}
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Stack Trace</h4>
                        <pre className="bg-gray-100 p-3 rounded-md text-xs overflow-x-auto">
                          {error?.stack || 'No stack trace available'}
                        </pre>
                      </div>

                      {/* Error Cause Chain */}
                      {error?.cause && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Error Cause Chain</h4>
                          <div className="bg-gray-100 p-3 rounded-md text-xs">
                            {this.renderCauseChain(error.cause)}
                          </div>
                        </div>
                      )}

                      {/* Component Stack */}
                      {errorInfo?.componentStack && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Component Stack</h4>
                          <pre className="bg-gray-100 p-3 rounded-md text-xs overflow-x-auto">
                            {errorInfo.componentStack}
                          </pre>
                        </div>
                      )}

                      {/* Environment Info */}
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Environment</h4>
                        <div className="bg-gray-100 p-3 rounded-md text-xs space-y-1">
                          <div><strong>URL:</strong> {window?.location?.href}</div>
                          <div><strong>User Agent:</strong> {navigator?.userAgent}</div>
                          <div><strong>Timestamp:</strong> {new Date().toISOString()}</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Contact Support */}
                <div className="text-center text-sm text-gray-600">
                  <p>If this problem persists, please contact our support team.</p>
                  <Button variant="link" className="text-blue-600 hover:text-blue-800 p-0 h-auto">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Contact Support
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )
    }

    return this.props.children
  }

  private renderCauseChain(cause: any, depth = 0): React.ReactNode {
    if (!cause) return null
    
    const indent = '  '.repeat(depth)
    return (
      <div>
        <div>{indent}↳ {cause.name || 'Error'}: {cause.message}</div>
        {cause.cause && this.renderCauseChain(cause.cause, depth + 1)}
      </div>
    )
  }
}

// Higher-order component wrapper for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <AppErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </AppErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  return WrappedComponent
}

// Hook for triggering error boundary from functional components
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null)

  const captureError = React.useCallback((error: Error | string) => {
    const errorObj = typeof error === 'string' ? new Error(error) : error
    setError(errorObj)
  }, [])

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  return { captureError }
}

export default AppErrorBoundary 