'use client'

import React from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { updateUserProfile, UserFormState } from '@/app/actions/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useTranslation } from '@/node_modules/react-i18next'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { Globe, Linkedin, Twitter, Github } from 'lucide-react'

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

function SubmitButton() {
  const { pending } = useFormStatus()
  const { t } = useTranslation()
  
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

function UserProfileFormContent() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const [state, formAction] = useActionState<UserFormState | null, FormData>(
    updateUserProfile,
    null
  )

  if (!session?.user) {
    return (
      <Alert>
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>Please log in to update your profile.</AlertDescription>
      </Alert>
    )
  }

  return (
    <form action={formAction} className="space-y-6">
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

      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t('basicInformation') || 'Basic Information'}</h3>
        
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
          {state?.fieldErrors?.name && (
            <p className="mt-1 text-sm text-destructive">{state.fieldErrors.name}</p>
          )}
        </div>

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

      {/* Professional Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t('professionalInformation') || 'Professional Information'}</h3>
        
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

      {/* Social Links */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t('socialLinks') || 'Social Links'}</h3>
        
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

        <div>
          <Label htmlFor="linkedin" className="flex items-center gap-2">
            <Linkedin className="h-4 w-4" />
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

        <div>
          <Label htmlFor="twitter" className="flex items-center gap-2">
            <Twitter className="h-4 w-4" />
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

        <div>
          <Label htmlFor="github" className="flex items-center gap-2">
            <Github className="h-4 w-4" />
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

      <SubmitButton />
    </form>
  )
}

/**
 * UserProfileForm component
 * Modern React 19 implementation with Server Actions
 * 
 * Features:
 * - useActionState() for form state management
 * - useFormStatus() for automatic loading states
 * - Server-side validation with field-specific errors
 * - Progressive enhancement (works without JavaScript)
 * - Comprehensive profile management
 * 
 * @returns JSX.Element
 */
export default function UserProfileForm() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const router = useRouter()

  // Handle unauthenticated users
  React.useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(ROUTES.LOGIN(DEFAULT_LOCALE))
    }
  }, [status, router])

  if (status === 'loading') {
    return <div className="text-center py-8">{t('loading') || 'Loading...'}</div>
  }

  if (status === 'unauthenticated') {
    return <div className="text-center py-8">{t('redirecting') || 'Redirecting...'}</div>
  }

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