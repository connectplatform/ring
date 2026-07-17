'use client'

import React from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useLocale } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { updateUserProfile, UserFormState } from '@/app/_actions/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { Globe } from 'lucide-react'
import { LinkedinIcon } from '@/components/ui/icons/linkedin-icon'
import { TwitterIcon } from '@/components/ui/icons/twitter-icon'
import { GithubIcon } from '@/components/ui/icons/github-icon'

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

// SubmitButton renders the form's submit button
function SubmitButton() {
  // Destructure pending status from react-dom's useFormStatus
  const { pending } = useFormStatus()
  const t = useTranslations('modules.profile')
  // TODO: If i18n keys are missing, could fallback to a centralized fallback utility

  return (
    <Button 
      type="submit" 
      disabled={pending}
      className="w-full"
    >
      {pending ? t('saving') || 'Saving...' : t('saveProfile') || 'Save Profile'}
    </Button>
  )
}

// The main content of the user profile form, including error/success state handling
function UserProfileFormContent() {
  const t = useTranslations('modules.profile')
  const locale = useLocale() as Locale
  const { data: session } = useSession()
  // useActionState for handling server action statefully on the client
  // TODO: Switch to inline server action (React 19/Next 16) once possible for more atomicity & colocation
  const [state, formAction] = useActionState<UserFormState | null, FormData>(
    (prevState, formData) => updateUserProfile(prevState, formData, locale),
    null
  )

  // If the user is not authenticated, show an alert (usually not shown due to top-level auth, but defensive)
  if (!session?.user) {
    return (
      <Alert>
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>Please log in to update your profile.</AlertDescription>
      </Alert>
    )
  }

  // TODO: Consider using React 19 useFormAction for better progressive-enhancement and direct mutation
  return (
    <form action={formAction} className="space-y-6">
      {/* Show error message if present in state */}
      {state?.error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Show success message if present in state */}
      {state?.success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {/* ------ Basic Information Section ------ */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t('basicInformation') || 'Basic Information'}</h3>
        
        {/* Name Field */}
        <div>
          <Label htmlFor="name">{t('fullName') || 'Full Name'} *</Label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={session.user.name || ''}
            placeholder={t('enterFullName') || 'Enter your full name'}
            aria-invalid={!!state?.fieldErrors?.name}
          />
          {/* Field-level validation error display */}
          {state?.fieldErrors?.name && (
            <p className="mt-1 text-sm text-destructive">{state.fieldErrors.name}</p>
          )}
        </div>

        {/* Username Field */}
        <div>
          <Label htmlFor="username">{t('username') || 'Username'}</Label>
          <Input
            id="username"
            name="username"
            type="text"
            placeholder={t('chooseUsername') || 'Choose a unique username'}
            aria-invalid={!!state?.fieldErrors?.username}
          />
          {state?.fieldErrors?.username && (
            <p className="mt-1 text-sm text-destructive">{state.fieldErrors.username}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{t('usernameHint') || '3-32 chars, letters, numbers, underscore, hyphen. Public profile: /u/yourname'}</p>
        </div>

        {/* Email Field */}
        <div>
          <Label htmlFor="email">{t('email') || 'Email'} *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={session.user.email || ''}
            placeholder={t('enterEmail') || 'Enter your email address'}
            aria-invalid={!!state?.fieldErrors?.email}
          />
          {state?.fieldErrors?.email && (
            <p className="mt-1 text-sm text-destructive">{state.fieldErrors.email}</p>
          )}
        </div>

        {/* Bio Field */}
        <div>
          <Label htmlFor="bio">{t('bio') || 'Bio'}</Label>
          <Textarea
            id="bio"
            name="bio"
            rows={4}
            placeholder={t('tellUsAboutYourself') || 'Tell us about yourself...'}
            className="resize-none"
          />
          {state?.fieldErrors?.bio && (
            <p className="mt-1 text-sm text-destructive">{state.fieldErrors.bio}</p>
          )}
        </div>
      </div>

      <Separator />

      {/* ------ Professional Information Section ------ */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t('professionalInformation') || 'Professional Information'}</h3>
        
        {/* Company Field */}
        <div>
          <Label htmlFor="company">{t('company') || 'Company'}</Label>
          <Input
            id="company"
            name="company"
            type="text"
            placeholder={t('enterCompany') || 'Enter your company name'}
          />
          {state?.fieldErrors?.company && (
            <p className="mt-1 text-sm text-destructive">{state.fieldErrors.company}</p>
          )}
        </div>

        {/* Position Field */}
        <div>
          <Label htmlFor="position">{t('position') || 'Position'}</Label>
          <Input
            id="position"
            name="position"
            type="text"
            placeholder={t('enterPosition') || 'Enter your job title'}
          />
          {state?.fieldErrors?.position && (
            <p className="mt-1 text-sm text-destructive">{state.fieldErrors.position}</p>
          )}
        </div>

        {/* Location Field */}
        <div>
          <Label htmlFor="location">{t('location') || 'Location'}</Label>
          <Input
            id="location"
            name="location"
            type="text"
            placeholder={t('enterLocation') || 'Enter your location'}
          />
          {state?.fieldErrors?.location && (
            <p className="mt-1 text-sm text-destructive">{state.fieldErrors.location}</p>
          )}
        </div>
      </div>

      <Separator />

      {/* ------ Social Links Section ------ */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t('socialLinks') || 'Social Links'}</h3>
        
        {/* Website Field */}
        <div>
          <Label htmlFor="website" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t('website') || 'Website'}
          </Label>
          <Input
            id="website"
            name="website"
            type="url"
            placeholder="https://example.com"
          />
          {state?.fieldErrors?.website && (
            <p className="mt-1 text-sm text-destructive">{state.fieldErrors.website}</p>
          )}
        </div>

        {/* LinkedIn Field */}
        <div>
          <Label htmlFor="linkedin" className="flex items-center gap-2">
            <LinkedinIcon className="h-4 w-4" />
            LinkedIn
          </Label>
          <Input
            id="linkedin"
            name="linkedin"
            type="url"
            placeholder="https://linkedin.com/in/yourname"
          />
          {state?.fieldErrors?.linkedin && (
            <p className="mt-1 text-sm text-destructive">{state.fieldErrors.linkedin}</p>
          )}
        </div>

        {/* Twitter/X Field */}
        <div>
          <Label htmlFor="twitter" className="flex items-center gap-2">
            <TwitterIcon className="h-4 w-4" />
            Twitter/X
          </Label>
          <Input
            id="twitter"
            name="twitter"
            type="url"
            placeholder="https://twitter.com/yourname"
          />
          {state?.fieldErrors?.twitter && (
            <p className="mt-1 text-sm text-destructive">{state.fieldErrors.twitter}</p>
          )}
        </div>

        {/* GitHub Field */}
        <div>
          <Label htmlFor="github" className="flex items-center gap-2">
            <GithubIcon className="h-4 w-4" />
            GitHub
          </Label>
          <Input
            id="github"
            name="github"
            type="url"
            placeholder="https://github.com/yourname"
          />
          {state?.fieldErrors?.github && (
            <p className="mt-1 text-sm text-destructive">{state.fieldErrors.github}</p>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <SubmitButton />
    </form>
  )
}

/**
 * UserProfileForm component
 * Uses modern React 19 + Next 16 concepts for form with server action
 * 
 * Features:
 * - useActionState() manages and reacts to form state server-side+client-side
 * - useFormStatus() enables automatic loading state for submit
 * - Field- and form-level server-side validation (with error/success messaging in UI)
 * - Designed for robust progressive enhancement (SSR works without JS)
 * - Comprehensive profile UI management
 * 
 * @returns JSX.Element
 */
export default function UserProfileForm() {
  const t = useTranslations('modules.profile')
  const { data: session, status } = useSession()
  const router = useRouter()

  // Phase F: protected mount — wait on loading; never router.push(LOGIN) / DEFAULT_LOCALE.
  // TODO: Prefer useProtectedSession() once this form is fully under (protected) layout.
  if (status === 'loading') {
    return <div className="text-center py-8">{t('loading') || 'Loading...'}</div>
  }

  if (status === 'unauthenticated') {
    return <div className="text-center py-8">{t('redirecting') || 'Session required…'}</div>
  }

  // Main profile card/form UI
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{t('userProfile') || 'User Profile'}</CardTitle>
        <CardDescription>
          {t('userProfileDescription') || 'Manage your personal information and social links'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <UserProfileFormContent />
      </CardContent>
    </Card>
  )
}