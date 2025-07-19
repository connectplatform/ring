'use client'

import React, { Suspense, startTransition, useDeferredValue } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface EnhancedSuspenseBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  level?: 'page' | 'section' | 'component'
  name?: string
  showProgress?: boolean
  retryEnabled?: boolean
  // @ts-ignore React 19 serialization - client-side callback
  onRetry?: () => void
  description?: string
  estimatedLoadTime?: number
  loadingStates?: LoadingState[]
}

interface LoadingState {
  step: number
  label: string
  duration: number
  icon: React.ReactNode
}

interface EnhancedLoadingFallbackProps {
  level: 'page' | 'section' | 'component'
  name?: string
  showProgress: boolean
  retryEnabled: boolean
  // @ts-ignore React 19 serialization - client-side callback
  onRetry?: () => void
  description?: string
  estimatedLoadTime?: number
  loadingStates?: LoadingState[]
}

// Default loading states for different components
const DEFAULT_LOADING_STATES = {
  entities: [
    { step: 1, label: 'Connecting to database', duration: 800, icon: <Loader2 className="h-4 w-4" /> },
    { step: 2, label: 'Loading entities', duration: 1200, icon: <RefreshCw className="h-4 w-4" /> },
    { step: 3, label: 'Applying filters', duration: 600, icon: <AlertCircle className="h-4 w-4" /> },
    { step: 4, label: 'Rendering components', duration: 400, icon: <Loader2 className="h-4 w-4" /> }
  ],
  opportunities: [
    { step: 1, label: 'Fetching opportunities', duration: 1000, icon: <Loader2 className="h-4 w-4" /> },
    { step: 2, label: 'Loading organization data', duration: 800, icon: <RefreshCw className="h-4 w-4" /> },
    { step: 3, label: 'Processing filters', duration: 500, icon: <AlertCircle className="h-4 w-4" /> }
  ],
  profile: [
    { step: 1, label: 'Loading user profile', duration: 600, icon: <Loader2 className="h-4 w-4" /> },
    { step: 2, label: 'Fetching preferences', duration: 400, icon: <RefreshCw className="h-4 w-4" /> }
  ],
  messaging: [
    { step: 1, label: 'Connecting to chat', duration: 700, icon: <Loader2 className="h-4 w-4" /> },
    { step: 2, label: 'Loading conversation history', duration: 900, icon: <RefreshCw className="h-4 w-4" /> },
    { step: 3, label: 'Establishing real-time connection', duration: 500, icon: <AlertCircle className="h-4 w-4" /> }
  ],
  news: [
    { step: 1, label: 'Loading news articles', duration: 800, icon: <Loader2 className="h-4 w-4" /> },
    { step: 2, label: 'Processing content', duration: 600, icon: <RefreshCw className="h-4 w-4" /> },
    { step: 3, label: 'Applying analytics', duration: 400, icon: <AlertCircle className="h-4 w-4" /> }
  ]
}

function EnhancedLoadingFallback({
  level,
  name = 'content',
  showProgress = false,
  retryEnabled = false,
  onRetry,
  description,
  estimatedLoadTime = 2000,
  loadingStates
}: EnhancedLoadingFallbackProps) {
  const [currentStep, setCurrentStep] = React.useState(0)
  const [elapsedTime, setElapsedTime] = React.useState(0)
  const [isRetrying, setIsRetrying] = React.useState(false)

  // Deferred values for smooth animations
  const deferredCurrentStep = useDeferredValue(currentStep)
  const deferredElapsedTime = useDeferredValue(elapsedTime)

  // Progress simulation for loading states
  React.useEffect(() => {
    if (!loadingStates || !showProgress) return

    let timeoutId: NodeJS.Timeout
    let currentTime = 0

    const simulateProgress = () => {
      const currentState = loadingStates[currentStep]
      if (!currentState) return

      currentTime += 100
      setElapsedTime(currentTime)

      if (currentTime >= currentState.duration && currentStep < loadingStates.length - 1) {
        setCurrentStep(prev => prev + 1)
        currentTime = 0
      }

      timeoutId = setTimeout(simulateProgress, 100)
    }

    simulateProgress()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [currentStep, loadingStates, showProgress])

  // Client-side retry handler - not a Server Action
  const handleRetry = () => {
    if (!onRetry) return

    setIsRetrying(true)
    startTransition(() => {
      onRetry()
      setTimeout(() => setIsRetrying(false), 1000)
    })
  }

  const getLayoutByLevel = () => {
    switch (level) {
      case 'page':
        return {
          containerClass: 'min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900',
          cardClass: 'max-w-md w-full mx-4',
          showDetails: true
        }
      case 'section':
        return {
          containerClass: 'min-h-[400px] flex items-center justify-center bg-gray-50/50 dark:bg-gray-800/50 rounded-lg',
          cardClass: 'max-w-sm w-full',
          showDetails: true
        }
      case 'component':
        return {
          containerClass: 'min-h-[200px] flex items-center justify-center',
          cardClass: 'w-full',
          showDetails: false
        }
    }
  }

  const layout = getLayoutByLevel()
  const progressPercentage = loadingStates && currentStep < loadingStates.length
    ? ((currentStep + 1) / loadingStates.length) * 100
    : (deferredElapsedTime / estimatedLoadTime) * 100

  return (
    <div className={layout.containerClass} data-testid="enhanced-suspense-loading">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={layout.cardClass}
      >
        <Card className="shadow-lg border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-8 w-8 text-blue-500" />
              </motion.div>
              <Badge variant="secondary" className="px-3 py-1">
                Loading {name}
              </Badge>
            </div>
            <CardTitle className="text-lg font-semibold">
              {level === 'page' ? 'Loading Page' : 
               level === 'section' ? 'Loading Section' : 
               'Loading Component'}
            </CardTitle>
            {description && (
              <CardDescription className="text-sm mt-2">
                {description}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {showProgress && layout.showDetails && (
              <>
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <motion.div
                    className="bg-blue-500 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(progressPercentage, 100)}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                {/* Loading Steps */}
                {loadingStates && (
                  <div className="space-y-2">
                    <AnimatePresence>
                      {loadingStates.map((state, index) => (
                        <motion.div
                          key={state.step}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ 
                            opacity: index <= deferredCurrentStep ? 1 : 0.5,
                            x: 0
                          }}
                          exit={{ opacity: 0, x: 20 }}
                          className={`flex items-center space-x-3 text-sm ${
                            index === deferredCurrentStep 
                              ? 'text-blue-600 dark:text-blue-400' 
                              : index < deferredCurrentStep 
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-gray-500'
                          }`}
                        >
                          <motion.div
                            animate={index === deferredCurrentStep ? { rotate: 360 } : {}}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          >
                            {state.icon}
                          </motion.div>
                          <span>{state.label}</span>
                          {index < deferredCurrentStep && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="text-green-500"
                            >
                              ✓
                            </motion.div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {/* Estimated Time */}
                <div className="text-center text-xs text-gray-500">
                  Estimated time: {Math.ceil(estimatedLoadTime / 1000)}s
                </div>
              </>
            )}

            {/* Retry Button */}
            {retryEnabled && onRetry && layout.showDetails && (
              <div className="text-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="text-xs"
                >
                  {isRetrying ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-2" />
                      Retry
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

/**
 * Enhanced Suspense Boundary with React 19 features
 * 
 * Features:
 * - Strategic loading states based on component level
 * - Progress simulation with loading steps
 * - Retry functionality for failed loads
 * - Deferred values for smooth animations
 * - Start transition for non-blocking operations
 * - Level-based layout adaptation
 * - Estimated load time display
 * 
 * @param props - EnhancedSuspenseBoundaryProps
 */
export function EnhancedSuspenseBoundary({
  children,
  fallback,
  level = 'component',
  name,
  showProgress = true,
  retryEnabled = false,
  onRetry,
  description,
  estimatedLoadTime = 2000,
  loadingStates
}: EnhancedSuspenseBoundaryProps) {
  // Auto-detect loading states based on component name
  const autoLoadingStates = React.useMemo(() => {
    if (loadingStates) return loadingStates
    
    const componentType = name?.toLowerCase()
    if (componentType?.includes('entit')) return DEFAULT_LOADING_STATES.entities
    if (componentType?.includes('opportunit')) return DEFAULT_LOADING_STATES.opportunities
    if (componentType?.includes('profile')) return DEFAULT_LOADING_STATES.profile
    if (componentType?.includes('messag') || componentType?.includes('chat')) return DEFAULT_LOADING_STATES.messaging
    if (componentType?.includes('news') || componentType?.includes('article')) return DEFAULT_LOADING_STATES.news
    
    return undefined
  }, [name, loadingStates])

  const defaultFallback = (
    <EnhancedLoadingFallback
      level={level}
      name={name}
      showProgress={showProgress}
      retryEnabled={retryEnabled}
      onRetry={onRetry}
      description={description}
      estimatedLoadTime={estimatedLoadTime}
      loadingStates={autoLoadingStates}
    />
  )

  return (
    <Suspense fallback={fallback || defaultFallback}>
      {children}
    </Suspense>
  )
}

// Specialized Suspense boundaries for different component types
export function EntitySuspenseBoundary({ children, ...props }: Omit<EnhancedSuspenseBoundaryProps, 'name' | 'loadingStates'>) {
  return (
    <EnhancedSuspenseBoundary
      {...props}
      name="entities"
      loadingStates={DEFAULT_LOADING_STATES.entities}
      estimatedLoadTime={3000}
    >
      {children}
    </EnhancedSuspenseBoundary>
  )
}

export function OpportunitySuspenseBoundary({ children, ...props }: Omit<EnhancedSuspenseBoundaryProps, 'name' | 'loadingStates'>) {
  return (
    <EnhancedSuspenseBoundary
      {...props}
      name="opportunities"
      loadingStates={DEFAULT_LOADING_STATES.opportunities}
      estimatedLoadTime={2300}
    >
      {children}
    </EnhancedSuspenseBoundary>
  )
}

export function ProfileSuspenseBoundary({ children, ...props }: Omit<EnhancedSuspenseBoundaryProps, 'name' | 'loadingStates'>) {
  return (
    <EnhancedSuspenseBoundary
      {...props}
      name="profile"
      loadingStates={DEFAULT_LOADING_STATES.profile}
      estimatedLoadTime={1000}
    >
      {children}
    </EnhancedSuspenseBoundary>
  )
}

export function MessagingSuspenseBoundary({ children, ...props }: Omit<EnhancedSuspenseBoundaryProps, 'name' | 'loadingStates'>) {
  return (
    <EnhancedSuspenseBoundary
      {...props}
      name="messaging"
      loadingStates={DEFAULT_LOADING_STATES.messaging}
      estimatedLoadTime={2100}
    >
      {children}
    </EnhancedSuspenseBoundary>
  )
}

export function NewsSuspenseBoundary({ children, ...props }: Omit<EnhancedSuspenseBoundaryProps, 'name' | 'loadingStates'>) {
  return (
    <EnhancedSuspenseBoundary
      {...props}
      name="news"
      loadingStates={DEFAULT_LOADING_STATES.news}
      estimatedLoadTime={1800}
    >
      {children}
    </EnhancedSuspenseBoundary>
  )
} 