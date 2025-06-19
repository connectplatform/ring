'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/constants/routes'
import { useTranslation } from '@/node_modules/react-i18next'
import { useSession, signIn } from 'next-auth/react'
import {
  AUTH_FORM_LABELS,
  AUTH_BUTTON_LABELS,
  AUTH_FORM_PLACEHOLDERS,
  AUTH_VALIDATION_MESSAGES,
  ERROR_MESSAGES
} from '@/features/auth/constants'

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

// Define the MotionDiv component with proper typing
const MotionDiv = motion.div

/**
 * FormData interface
 * Defines the structure of the form data
 */
interface FormData {
  name: string
  email: string
  password: string
  confirmPassword: string
}

/**
 * ValidationErrors interface
 * Defines the structure of validation errors
 */
interface ValidationErrors {
  name: string
  email: string
  password: string
  confirmPassword: string
}

/**
 * SignupForm component
 * Renders a form for user registration
 * 
 * User steps:
 * 1. User fills out the registration form with name, email, password, and password confirmation
 * 2. Form validates input on submission
 * 3. If validation passes, form submits data to server
 * 4. User is redirected to profile page on successful registration
 * 5. Error messages are displayed if registration fails
 * 
 * @returns JSX.Element
 */
function SignupForm() {
  const { t } = useTranslation()
  const router = useRouter()
  const { data: session } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  /**
   * Handles input change events
   * @param e - React.ChangeEvent<HTMLinputElement>
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setValidationErrors(prev => ({ ...prev, [name]: '' }))
  }

  /**
   * Validates form inputs
   * @returns boolean - true if form is valid, false otherwise
   */
  const validateForm = () => {
    let isValid = true
    const newErrors: ValidationErrors = { name: '', email: '', password: '', confirmPassword: '' }

    if (!formData.name) {
      newErrors.name = AUTH_VALIDATION_MESSAGES.REQUIRED_FIELD
      isValid = false
    }

    if (!formData.email) {
      newErrors.email = AUTH_VALIDATION_MESSAGES.REQUIRED_FIELD
      isValid = false
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = AUTH_VALIDATION_MESSAGES.INVALID_EMAIL
      isValid = false
    }

    if (!formData.password) {
      newErrors.password = AUTH_VALIDATION_MESSAGES.REQUIRED_FIELD
      isValid = false
    } else if (formData.password.length < 6) {
      newErrors.password = AUTH_VALIDATION_MESSAGES.PASSWORD_TOO_SHORT
      isValid = false
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = AUTH_VALIDATION_MESSAGES.PASSWORD_MISMATCH
      isValid = false
    }

    setValidationErrors(newErrors)
    return isValid
  }

  /**
   * Handles form submission
   * @param e - React.FormEvent
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsLoading(true)
    setError(null)
    try {
      const result = await signIn('credentials', {
        redirect: false,
        name: formData.name,
        email: formData.email,
        password: formData.password,
      })

      if (result?.error) {
        setError(ERROR_MESSAGES.UNKNOWN_ERROR)
      } else {
        router.replace(ROUTES.PROFILE(DEFAULT_LOCALE))
      }
    } catch (error) {
      setError(ERROR_MESSAGES.UNKNOWN_ERROR)
    }
    setIsLoading(false)
  }

  if (session) {
    router.replace(ROUTES.PROFILE(DEFAULT_LOCALE))
    return null
  }

  return (
    <MotionDiv
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="text-3xl font-bold text-center mb-6">{AUTH_FORM_LABELS.SIGN_UP}</h1>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="name">{AUTH_FORM_LABELS.NAME}</Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            placeholder={AUTH_FORM_PLACEHOLDERS.NAME}
            value={formData.name}
            onChange={handleChange}
            aria-invalid={!!validationErrors.name}
            aria-describedby="name-error"
          />
          {validationErrors.name && (
            <p id="name-error" className="mt-1 text-sm text-destructive">
              {validationErrors.name}
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
            value={formData.email}
            onChange={handleChange}
            aria-invalid={!!validationErrors.email}
            aria-describedby="email-error"
          />
          {validationErrors.email && (
            <p id="email-error" className="mt-1 text-sm text-destructive">
              {validationErrors.email}
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
            value={formData.password}
            onChange={handleChange}
            aria-invalid={!!validationErrors.password}
            aria-describedby="password-error"
          />
          {validationErrors.password && (
            <p id="password-error" className="mt-1 text-sm text-destructive">
              {validationErrors.password}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="confirm-password">{AUTH_FORM_LABELS.CONFIRM_PASSWORD}</Label>
          <Input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            placeholder={AUTH_FORM_PLACEHOLDERS.CONFIRM_PASSWORD}
            value={formData.confirmPassword}
            onChange={handleChange}
            aria-invalid={!!validationErrors.confirmPassword}
            aria-describedby="confirm-password-error"
          />
          {validationErrors.confirmPassword && (
            <p id="confirm-password-error" className="mt-1 text-sm text-destructive">
              {validationErrors.confirmPassword}
            </p>
          )}
        </div>
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? t('signingUp') : AUTH_BUTTON_LABELS.SIGN_UP}
        </Button>
      </form>
      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}
    </MotionDiv>
  )
}

/**
 * email-signup-form component
 * Wrapper component for SignupForm
 * 
 * @returns JSX.Element
 */
export default function EmailSignupForm() {
  return <SignupForm />
}

