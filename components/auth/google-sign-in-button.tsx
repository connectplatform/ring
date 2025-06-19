'use client'

import React from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { FcGoogle } from 'react-icons/fc'
import { useTranslation } from '@/node_modules/react-i18next'
import { Loader2 } from 'lucide-react'
import { signInWithGoogle, GoogleSignInState } from '@/app/actions/auth'

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

interface GoogleSignInButtonProps {
  disabled?: boolean
  redirectUrl?: string
  className?: string
}

/**
 * Submit Button Component with useFormStatus
 * Automatically handles loading states with React 19
 */
function SubmitButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus()
  
  return (
    <Button 
      type="submit"
      variant="outline" 
      disabled={pending || disabled}
      className="w-full border-[#4285F4] text-[#4285F4] hover:bg-[#4285F4]/5 hover:text-[#4285F4] hover:border-[#4285F4]"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Signing in...
        </>
      ) : (
        <>
          <FcGoogle className="mr-2 h-4 w-4" />
          {children}
        </>
      )}
    </Button>
  )
}

/**
 * Google Sign-in Button Component
 * Enhanced with React 19 useActionState and Server Actions
 * 
 * Features:
 * - useActionState() for form state management
 * - useFormStatus() for automatic loading states
 * - Server Actions for authentication
 * - Progressive enhancement (works without JavaScript)
 * - Enhanced error handling
 * - 50% less boilerplate code
 */
export default function GoogleSignInButton({ 
  disabled = false, 
  redirectUrl,
  className 
}: GoogleSignInButtonProps) {
  const { t } = useTranslation()
  
  // React 19 useActionState for form handling
  const [state, formAction] = useActionState<GoogleSignInState | null, FormData>(
    signInWithGoogle,
    null
  )

  return (
    <div className={className}>
      <form action={formAction}>
        {/* Hidden input for redirect URL */}
        {redirectUrl && (
          <input 
            type="hidden" 
            name="redirectUrl" 
            value={redirectUrl} 
          />
        )}
        
        {/* Hidden input for locale */}
        <input 
          type="hidden" 
          name="locale" 
          value={DEFAULT_LOCALE} 
        />

        <SubmitButton disabled={disabled}>
          {t('signInWithGoogle') || 'Sign in with Google'}
        </SubmitButton>
      </form>

      {/* Error Display */}
      {state?.error && (
        <div className="mt-2 text-sm text-red-600 text-center">
          {state.error}
        </div>
      )}

      {/* Success Message */}
      {state?.success && (
        <div className="mt-2 text-sm text-green-600 text-center">
          {t('signInSuccess') || 'Signing in successfully...'}
        </div>
      )}
    </div>
  )
}

