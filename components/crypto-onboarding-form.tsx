'use client'

import React from 'react'
import { useActionState, useOptimistic } from 'react'
import { useFormStatus } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, User, Mail, Wallet, CheckCircle } from 'lucide-react'
import { completeCryptoOnboarding, CryptoOnboardingFormState } from '@/app/actions/crypto'

/**
 * Props for the CryptoOnboardingForm component
 */
interface CryptoOnboardingFormProps {
  onComplete?: () => Promise<void>
}

/**
 * Optimistic state for crypto onboarding updates
 */
interface OptimisticOnboardingState {
  isUpdating: boolean
  profileData?: {
    name: string
    email: string
  }
}

/**
 * Submit button with loading state from useFormStatus
 */
function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  
  return (
    <Button 
      type="submit" 
      disabled={pending}
      className="w-full h-12 text-base font-medium"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Completing Profile...
        </>
      ) : (
        <>
          <CheckCircle className="mr-2 h-4 w-4" />
          {children}
        </>
      )}
    </Button>
  )
}

/**
 * CryptoOnboardingForm component
 * Modern React 19 implementation with Server Actions for crypto user onboarding
 * 
 * Features:
 * - useActionState() for form state management
 * - useOptimistic() for instant UI updates
 * - useFormStatus() for automatic loading states
 * - Server Actions for profile updates and session management
 * - Progressive enhancement (works without JavaScript)
 * - Enhanced error handling and validation
 * - Smooth animations with framer-motion
 * - Integration with NextAuth session updates
 * 
 * User Flow:
 * 1. Crypto user (MetaMask/wallet) needs to complete profile
 * 2. User fills out name and email fields
 * 3. Form validates input and shows instant feedback
 * 4. On successful submission, session is updated and onComplete callback is triggered
 * 5. Optimistic updates provide immediate visual feedback
 * 
 * @param {CryptoOnboardingFormProps} props - Component props
 * @returns JSX.Element
 */
export default function CryptoOnboardingForm({ 
  onComplete 
}: CryptoOnboardingFormProps) {
  const { data: session, update } = useSession()
  
  // Form state management with useActionState
  const [state, formAction] = useActionState<CryptoOnboardingFormState | null, FormData>(
    completeCryptoOnboarding,
    null
  )

  // Optimistic state for instant UI updates
  const [optimisticState, setOptimisticState] = useOptimistic<
    OptimisticOnboardingState,
    Partial<OptimisticOnboardingState>
  >(
    { isUpdating: false },
    (currentState, update) => ({ ...currentState, ...update })
  )

  // Handle successful form completion
  React.useEffect(() => {
    if (state?.success) {
      // Update session to remove needsOnboarding flag
      if (update) {
        update({
          ...session,
          needsOnboarding: false,
        })
      }
      
      // Call completion callback
      if (onComplete) {
        onComplete()
      }
    }
  }, [state?.success, session, update, onComplete])

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: {
        duration: 0.5,
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  if (!session?.user?.id) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>Please connect your wallet to continue.</AlertDescription>
      </Alert>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-md mx-auto"
    >
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <motion.div variants={itemVariants}>
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">
              Complete Your Profile
            </CardTitle>
            <CardDescription className="text-base">
              We need a few details to set up your Ring account
            </CardDescription>
          </motion.div>
        </CardHeader>

        <CardContent>
          {/* Success Message */}
          <AnimatePresence>
            {state?.success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4"
              >
                <Alert className="border-green-200 bg-green-50 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Profile Completed!</AlertTitle>
                  <AlertDescription>{state.message}</AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Message */}
          <AnimatePresence>
            {state?.error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4"
              >
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <form action={formAction} className="space-y-4">
            {/* Hidden userId field */}
            <input type="hidden" name="userId" value={session.user.id} />

            {/* Name Field */}
            <motion.div variants={itemVariants} className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Full Name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Enter your full name"
                  defaultValue={session.user.name || ''}
                  required
                  className={`pl-10 ${
                    state?.fieldErrors?.name ? 'border-destructive' : ''
                  } ${
                    optimisticState.isUpdating ? 'opacity-70' : ''
                  }`}
                  aria-invalid={!!state?.fieldErrors?.name}
                  aria-describedby={state?.fieldErrors?.name ? "name-error" : undefined}
                />
              </div>
              {state?.fieldErrors?.name && (
                <p id="name-error" className="text-sm text-destructive">
                  {state.fieldErrors.name}
                </p>
              )}
            </motion.div>

            {/* Email Field */}
            <motion.div variants={itemVariants} className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email address"
                  defaultValue={session.user.email || ''}
                  required
                  className={`pl-10 ${
                    state?.fieldErrors?.email ? 'border-destructive' : ''
                  } ${
                    optimisticState.isUpdating ? 'opacity-70' : ''
                  }`}
                  aria-invalid={!!state?.fieldErrors?.email}
                  aria-describedby={state?.fieldErrors?.email ? "email-error" : undefined}
                />
              </div>
              {state?.fieldErrors?.email && (
                <p id="email-error" className="text-sm text-destructive">
                  {state.fieldErrors.email}
                </p>
              )}
            </motion.div>

            {/* Wallet Info Display */}
            <motion.div variants={itemVariants} className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4" />
                <span>Wallet Connected:</span>
                <code className="text-xs bg-background px-2 py-1 rounded">
                  {session.user.id?.slice(0, 6)}...{session.user.id?.slice(-4)}
                </code>
              </div>
            </motion.div>

            {/* Submit Button */}
            <motion.div variants={itemVariants} className="pt-4">
              <SubmitButton>
                {optimisticState.isUpdating ? 'Saving...' : 'Complete Profile'}
              </SubmitButton>
            </motion.div>
          </form>

          {/* Optimistic Update Indicator */}
          <AnimatePresence>
            {optimisticState.isUpdating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-4 text-center"
              >
                <div className="inline-flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating your profile...
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div 
            variants={itemVariants}
            className="mt-6 text-center text-xs text-muted-foreground"
          >
            Your wallet address will be used for secure authentication.{' '}
            <Link href="/privacy" className="underline hover:text-foreground">
              Learn more about privacy
            </Link>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  )
} 