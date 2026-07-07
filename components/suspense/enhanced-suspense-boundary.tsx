'use client'

import React, { Suspense, startTransition, useDeferredValue } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// Props for the main EnhancedSuspenseBoundary component
interface EnhancedSuspenseBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode // Optional custom fallback, otherwise uses EnhancedLoadingFallback
  level?: 'page' | 'section' | 'component' // Loading UX size/role
  name?: string // Used for step auto-detection and UI label
  showProgress?: boolean // Whether to show step/progress UI
  retryEnabled?: boolean // Whether retry button is shown
  // @ts-ignore React 19 serialization - client-side callback (Suppressed for now; revisit after official React 19 stable)
  onRetry?: () => void // Retry callback for failed loads (client only!)
  description?: string // Optional extra UI description field
  estimatedLoadTime?: number // ms
  loadingStates?: LoadingState[] // List of steps for granular loading animation
}

// Step for fine loading progress in fallback UI
interface LoadingState {
  step: number
  label: string
  duration: number
  icon: React.ReactNode // Icon for this step
}

// All props needed for the fallback loader component
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

// Default per-type loading flows with icons and durations
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

// Fallback UI rendered for the Suspense boundary; handles progress and optional retry
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
  const [currentStep, setCurrentStep] = React.useState(0) // Step index for progress
  const [elapsedTime, setElapsedTime] = React.useState(0) // ms since load started
  const [isRetrying, setIsRetrying] = React.useState(false) // Button disabling state

  // React 18+ hook to defer value updates during suspense for faster paint/smoother UI
  // TODO: Switch to use(transition) or SuspenseList + useOptimisticState when available in Next.js 16+ stable
  const deferredCurrentStep = useDeferredValue(currentStep)
  const deferredElapsedTime = useDeferredValue(elapsedTime)

  // Drive the animated progress bar, advancing steps at each state's duration
  React.useEffect(() => {
    if (!loadingStates || !showProgress) return

    let timeoutId: NodeJS.Timeout
    let currentTime = 0

    // Progresses through the loading states automatically at fixed rate (100ms tick)
    const simulateProgress = () => {
      const currentState = loadingStates[currentStep]
      if (!currentState) return // Done

      currentTime += 100
      setElapsedTime(currentTime)

      if (currentTime >= currentState.duration && currentStep < loadingStates.length - 1) {
        setCurrentStep(prev => prev + 1)
        currentTime = 0 // Reset for next state
      }

      timeoutId = setTimeout(simulateProgress, 100)
    }

    simulateProgress()

    // Cleanup timeouts on deps change/unmount
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [currentStep, loadingStates, showProgress])

  // Handler for optional retry button.
  // TODO: If React19+ supports passing server action/exceptions to retry, upgrade to native Suspense errorRecovery API.
  const handleRetry = () => {
    if (!onRetry) return

    setIsRetrying(true)
    startTransition(() => {
      onRetry()
      setTimeout(() => setIsRetrying(false), 1000)
    })
  }

  // UI layout/spacing styling varies per UX level (page, section, component)
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
          showDetails: false // component-level: compact/minimal UI
        }
      // TODO: Consider TS exhaustive check or fallback default
    }
  }

  const layout = getLayoutByLevel()

  // Compute progress percentage, based on steps if available, otherwise by elapsed time
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
              {/* Animated spinning loader */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-8 w-8 text-blue-500" />
              </motion.div>
              {/* Shows "Loading {name}" */}
              <Badge variant="secondary" className="px-3 py-1">
                Loading {name}
              </Badge>
            </div>
            <CardTitle className="text-lg font-semibold">
              {/* CardTitle based on UX level */}
              {level === 'page' ? 'Loading Page' : 
               level === 'section' ? 'Loading Section' : 
               'Loading Component'}
            </CardTitle>
            {/* Optional descriptive text */}
            {description && (
              <CardDescription className="text-sm mt-2">
                {description}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Main progress bar & steps */}
            {showProgress && layout.showDetails && (
              <>
                {/* Progress Bar: animated width as percent */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <motion.div
                    className="bg-blue-500 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(progressPercentage, 100)}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                {/* Loading Steps List with icons and highlighting of current/completed */}
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
                          {/* Spinning icon for current step, static for others */}
                          <motion.div
                            animate={index === deferredCurrentStep ? { rotate: 360 } : {}}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          >
                            {state.icon}
                          </motion.div>
                          <span>{state.label}</span>
                          {/* Check mark for completed states */}
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

                {/* Shows estimated time, for UX communication */}
                <div className="text-center text-xs text-gray-500">
                  Estimated time: {Math.ceil(estimatedLoadTime / 1000)}s
                </div>
              </>
            )}

            {/* Retry Button: shown only if explicitly enabled + callback exists + layout is page/section */}
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
  // Auto-detect loadingStates list based on `name` heuristics or explicit prop (allows out-of-the-box UX for common use cases)
  const autoLoadingStates = React.useMemo(() => {
    if (loadingStates) return loadingStates

    // Heuristic detection by name substring
    const componentType = name?.toLowerCase()
    if (componentType?.includes('entit')) return DEFAULT_LOADING_STATES.entities
    if (componentType?.includes('opportunit')) return DEFAULT_LOADING_STATES.opportunities
    if (componentType?.includes('profile')) return DEFAULT_LOADING_STATES.profile
    if (componentType?.includes('messag') || componentType?.includes('chat')) return DEFAULT_LOADING_STATES.messaging
    if (componentType?.includes('news') || componentType?.includes('article')) return DEFAULT_LOADING_STATES.news

    return undefined // No steps, will fallback to basic loader
  }, [name, loadingStates])

  // Fallback is either provided fallback or the built-in EnhancedLoadingFallback component
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

  // Use the new <Suspense> fallback prop for async boundaries
  // TODO: When Next.js 16+ supports errorRecovery (React19), allow passing recovery props for retry and granular error UI.
  return (
    <Suspense fallback={fallback || defaultFallback}>
      {children}
    </Suspense>
  )
}

// Factory wrappers for type-specific Suspense boundaries for smarter UI presets.
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