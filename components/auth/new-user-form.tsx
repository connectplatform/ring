'use client'

import React from 'react'
import { useActionState, useOptimistic } from 'react'
import { useFormStatus } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Loader2, User, Mail, Link as LinkIcon } from 'lucide-react'
import { completeUserProfile, linkGoogleAccount, UserProfileFormState } from '@/app/actions/auth'

/**
 * Props for the NewUserForm component
 */
interface NewUserFormProps {
  userId: string
  onComplete?: () => Promise<void>
  initialData?: {
    name?: string
    email?: string
  }
}

/**
 * Optimistic state for user profile updates
 */
interface OptimisticProfileState {
  isUpdating: boolean
  isLinking: boolean
  profileData?: {
    name: string
    email: string
  }
}

/**
 * Submit button with loading state from useFormStatus
 */
function SubmitButton({ children, variant = "default" }: { 
  children: React.ReactNode
  variant?: "default" | "outline" 
}) {
  const { pending } = useFormStatus()
  
  return (
    <Button 
      type="submit" 
      disabled={pending}
      variant={variant}
      className="w-full"
    >
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  )
}

/**
 * Google Link button with loading state
 */
function GoogleLinkButton({ userId }: { userId: string }) {
  const { pending } = useFormStatus()
  
  return (
    <Button
      type="submit"
      name="action"
      value="link-google"
      disabled={pending}
      variant="outline"
      className="w-full mb-4"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Linking...
        </>
      ) : (
        <>
          <LinkIcon className="mr-2 h-4 w-4" />
          Link Google Account
        </>
      )}
    </Button>
  )
}

/**
 * NewUserForm component
 * Modern React 19 implementation with Server Actions for user profile completion
 * 
 * Features:
 * - useActionState() for form state management
 * - useOptimistic() for instant UI updates
 * - useFormStatus() for automatic loading states
 * - Server Actions for profile updates and Google linking
 * - Progressive enhancement (works without JavaScript)
 * - Enhanced error handling and validation
 * - Smooth animations with framer-motion
 * 
 * User Flow:
 * 1. New user sees welcome message and profile completion form
 * 2. User can optionally link Google account for auto-fill
 * 3. User fills out name and email fields
 * 4. Form validates input and shows instant feedback
 * 5. On successful submission, onComplete callback is triggered
 * 6. Optimistic updates provide immediate visual feedback
 * 
 * @param {NewUserFormProps} props - Component props
 * @returns JSX.Element
 */
export default function NewUserForm({ 
  userId, 
  onComplete,
  initialData = {} 
}: NewUserFormProps) {
  // Form state management with useActionState
  const [state, formAction] = useActionState<UserProfileFormState | null, FormData>(
    completeUserProfile,
    null
  )

  // Optimistic state for instant UI updates
  const [optimisticState, setOptimisticState] = useOptimistic<
    OptimisticProfileState,
    Partial<OptimisticProfileState>
  >(
    { isUpdating: false, isLinking: false },
    (currentState, update) => ({ ...currentState, ...update })
  )

  // Handle successful form completion
  React.useEffect(() => {
    if (state?.success && onComplete) {
      onComplete()
    }
  }, [state?.success, onComplete])

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-md mx-auto p-6 bg-card text-card-foreground rounded-lg shadow-lg"
    >
      <motion.div variants={itemVariants} className="text-center mb-6">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Welcome to Ring!</h2>
        <p className="text-muted-foreground">
          Please complete your profile to get started
        </p>
      </motion.div>

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
              <AlertTitle>Success!</AlertTitle>
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
        <input type="hidden" name="userId" value={userId} />

        {/* Google Link Button */}
        <motion.div variants={itemVariants}>
          <GoogleLinkButton userId={userId} />
        </motion.div>

        <motion.div variants={itemVariants} className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or complete manually
            </span>
          </div>
        </motion.div>

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
              defaultValue={initialData.name || ''}
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
              defaultValue={initialData.email || ''}
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

        {/* Submit Button */}
        <motion.div variants={itemVariants} className="pt-4">
          <SubmitButton>
            {optimisticState.isUpdating ? 'Saving Profile...' : 'Complete Profile'}
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
        By completing your profile, you agree to our{' '}
        <Link href="/terms" className="underline hover:text-foreground">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </Link>
      </motion.div>
    </motion.div>
  )
} 