'use client'

import React from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { motion, Variants, AnimatePresence } from 'framer-motion'
import { registerUser, AuthFormState } from '@/app/_actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { useTranslations } from 'next-intl'
import { useSession } from '@/components/providers/session-provider'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { ROUTES } from '@/constants/routes'
import {
  AUTH_FORM_LABELS,
  AUTH_FORM_PLACEHOLDERS,
  AUTH_VALIDATION_MESSAGES,
} from '@/features/auth/constants'

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

// Define the MotionDiv component with proper typing
const MotionDiv = motion.div

function SubmitButton() {
  const { pending } = useFormStatus()
  const t = useTranslations('modules.auth')
  
  return (
    <Button 
      type="submit" 
      disabled={pending}
      className="w-full"
    >
      {pending ? t('creatingAccount') || 'Creating Account...' : AUTH_FORM_LABELS.SIGN_UP}
    </Button>
  )
}

function SignupFormContent() {
  const t = useTranslations('modules.auth')
  const [state, formAction] = useActionState<AuthFormState | null, FormData>(
    registerUser,
    null
  )

  return (
    <form action={formAction} className="space-y-4">
      {/* Show error message if any */}
      {state?.error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Show success message if any */}
      {state?.success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="name">{AUTH_FORM_LABELS.NAME}</Label>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          placeholder={AUTH_FORM_PLACEHOLDERS.NAME}
          aria-invalid={!!state?.fieldErrors?.name}
          aria-describedby="name-error"
        />
        {state?.fieldErrors?.name && (
          <p id="name-error" className="mt-1 text-sm text-destructive">
            {state.fieldErrors.name}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="email-address">{AUTH_FORM_LABELS.EMAIL}</Label>
        <Input
          id="email-address"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder={AUTH_FORM_PLACEHOLDERS.EMAIL}
          aria-invalid={!!state?.fieldErrors?.email}
          aria-describedby="email-error"
        />
        {state?.fieldErrors?.email && (
          <p id="email-error" className="mt-1 text-sm text-destructive">
            {state.fieldErrors.email}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="password">{AUTH_FORM_LABELS.PASSWORD}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          placeholder={AUTH_FORM_PLACEHOLDERS.PASSWORD}
          aria-invalid={!!state?.fieldErrors?.password}
          aria-describedby="password-error"
        />
        {state?.fieldErrors?.password && (
          <p id="password-error" className="mt-1 text-sm text-destructive">
            {state.fieldErrors.password}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="confirmPassword">{AUTH_FORM_LABELS.CONFIRM_PASSWORD}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          placeholder={AUTH_FORM_PLACEHOLDERS.CONFIRM_PASSWORD}
          aria-invalid={!!state?.fieldErrors?.confirmPassword}
          aria-describedby="confirm-password-error"
        />
        {state?.fieldErrors?.confirmPassword && (
          <p id="confirm-password-error" className="mt-1 text-sm text-destructive">
            {state.fieldErrors.confirmPassword}
          </p>
        )}
      </div>

      <SubmitButton />
    </form>
  )
}

/**
 * EmailSignupForm component
 * Modern React 19 implementation with Server Actions
 * 
 * Features:
 * - useActionState() for form state management
 * - useFormStatus() for automatic loading states
 * - Server-side validation with field-specific errors
 * - Progressive enhancement (works without JavaScript)
 * - Automatic error and success message handling
 * 
 * @returns JSX.Element
 */
export default function EmailSignupForm() {
  const t = useTranslations('modules.auth')
  const { data: session } = useSession()
  const router = useRouter()
  const locale = useLocale() as 'en' | 'uk'

  // Redirect if already authenticated
  React.useEffect(() => {
    if (session) {
      router.replace(ROUTES.PROFILE(locale))
    }
  }, [session, router, locale])

  if (session) {
    return null
  }

  return (
    <MotionDiv
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md mx-auto"
    >
      <h1 className="text-3xl font-bold text-center mb-6">
        {AUTH_FORM_LABELS.SIGN_UP}
      </h1>
      
      <SignupFormContent />
      
      <div className="mt-4 text-center text-sm text-muted-foreground">
        <span>{t('alreadyHaveAccount') || 'Already have an account?'} </span>
        <a 
          href={ROUTES.LOGIN(locale)} 
          className="text-primary hover:underline font-medium"
        >
          {t('signIn') || 'Sign in'}
        </a>
      </div>
    </MotionDiv>
  )
} 