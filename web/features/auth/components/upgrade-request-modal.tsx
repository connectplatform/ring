"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { type AuthUser, type RoleUpgradeRequest, UpgradeRequestStatus } from "@/features/auth/types"
import { UserRolesArray } from "@/features/auth/user-role"

interface UpgradeRequestModalProps {
  isOpen: boolean
  onClose: () => void
  user: AuthUser
  onSubmit: (data: Partial<RoleUpgradeRequest>) => Promise<void>
}

/**
 * UpgradeRequestModal Component
 * Modal for users to request role upgrades from subscriber to member
 */
export default function UpgradeRequestModal({ 
  isOpen, 
  onClose, 
  user, 
  onSubmit 
}: UpgradeRequestModalProps) {
  // TODO: If moving to React 19/Next 16, consider using useOptimistic from 'react' for handling async form submissions in a more declarative way.
  // TODO: Leverage server actions or Next.js Server Components pattern where possible to streamline logic and reduce client bundle size.

  // Hook for translation strings for the profile module
  const t = useTranslations('modules.profile')

  // State for form UI: submission, errors, and success messages.
  // 'isSubmitting': tracks if an async submit is in progress, disables form and prevents multiple submits
  const [isSubmitting, setIsSubmitting] = useState(false)
  // 'error': holds error string if submission fails
  const [error, setError] = useState<string | null>(null)
  // 'success': shows confirmation after successful submit
  const [success, setSuccess] = useState(false)

  /**
   * Form submit handler for upgrade request.
   * @param event - form submit event
   */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault() // Prevent browser's default form submission
    setIsSubmitting(true)
    setError(null) // Reset previous errors

    try {
      // Collect form field values using FormData API
      const formData = new FormData(event.currentTarget)
      // Build request payload according to RoleUpgradeRequest shape
      const requestData: Partial<RoleUpgradeRequest> = {
        userId: user.id, // The user's ID from props
        fromRole: user.role, // Current role (should always be 'subscriber')
        toRole: UserRolesArray[1], // Target role: assumed 'member', should ideally not be hardcoded
        status: UpgradeRequestStatus.PENDING, // Set request to pending state on creation
        // Required reason field
        reason: formData.get('reason') as string,
        // Optional fields (fallback to undefined if not entered)
        organization: formData.get('organization') as string || undefined,
        position: formData.get('position') as string || undefined,
        linkedinProfile: formData.get('linkedinProfile') as string || undefined,
        portfolioUrl: formData.get('portfolioUrl') as string || undefined,
        // Submission time
        submittedAt: new Date()
      }

      // Call parent submit handler (typically makes backend API call)
      await onSubmit(requestData)
      setSuccess(true)
      
      // After showing confirmation, close modal and clear success after 2 seconds
      setTimeout(() => {
        onClose()
        setSuccess(false)
      }, 2000)

    } catch (error) {
      // Log the error for debugging
      console.error('Error submitting upgrade request:', error)
      // Show generic error to user
      setError('Failed to submit upgrade request. Please try again.')
    } finally {
      setIsSubmitting(false) // Always reset submitting state
    }
  }

  /**
   * Handles dialog/modal close. Prevents closing if currently submitting.
   * Also resets error and success state.
   */
  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
      setError(null)
      setSuccess(false)
    }
  }

  // TODO: If/when Dialog component supports React 19 "useFormStatus", prefer that to manage disabled state of controls.

  // Render modal dialog
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('roleUpgrade.title') /* Title: i18n key */}</DialogTitle>
        </DialogHeader>

        {/* If form successfully submitted, show a success alert instead of the form */}
        {success ? (
          <div className="py-6 text-center">
            <Alert>
              <AlertTitle>{t('roleUpgrade.requestSubmitted')}</AlertTitle>
            </Alert>
          </div>
        ) : (
          // Upgrade request form
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current and requested role fields, read-only */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('roleUpgrade.currentRole')}</Label>
                <Input value={user.role} disabled />
              </div>
              <div className="space-y-2">
                <Label>{t('roleUpgrade.requestedRole')}</Label>
                {/* TODO: 'member' value is hardcoded: in future, consider mapping role keys or i18n here */}
                <Input value="member" disabled />
              </div>
            </div>

            {/* Reason (required text area) */}
            <div className="space-y-2">
              <Label htmlFor="reason">{t('roleUpgrade.reason')} *</Label>
              <Textarea
                id="reason"
                name="reason"
                required
                rows={3}
                placeholder="Please explain why you would like to upgrade your account..." // TODO: i18n this string
              />
            </div>

            {/* Organization field (optional) */}
            <div className="space-y-2">
              <Label htmlFor="organization">{t('roleUpgrade.organization')}</Label>
              <Input
                id="organization"
                name="organization"
                type="text"
                placeholder="Your company or organization name" // TODO: i18n this string
              />
            </div>

            {/* Position field (optional) */}
            <div className="space-y-2">
              <Label htmlFor="position">{t('roleUpgrade.position')}</Label>
              <Input
                id="position"
                name="position"
                type="text"
                placeholder="Your job title or position" // TODO: i18n this string
              />
            </div>

            {/* LinkedIn profile (optional) */}
            <div className="space-y-2">
              <Label htmlFor="linkedinProfile">{t('roleUpgrade.linkedinProfile')}</Label>
              <Input
                id="linkedinProfile"
                name="linkedinProfile"
                type="url"
                placeholder="https://linkedin.com/in/yourprofile"
                // TODO: add url validation or instruction after React 19 'useFormStatus' enhancement
              />
            </div>

            {/* Portfolio URL (optional) */}
            <div className="space-y-2">
              <Label htmlFor="portfolioUrl">{t('roleUpgrade.portfolioUrl')}</Label>
              <Input
                id="portfolioUrl"
                name="portfolioUrl"
                type="url"
                placeholder="https://yourportfolio.com"
                // TODO: add url validation or instruction after React 19 'useFormStatus' enhancement
              />
            </div>

            {/* Error alert box */}
            {error && (
              <Alert variant="destructive">
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}

            {/* Modal actions: Cancel & Submit buttons */}
            <DialogFooter>
              <Button 
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting} // Prevent closing while submitting
              >
                {t('cancel')}
              </Button>
              <Button 
                type="submit"
                disabled={isSubmitting} // Prevent multiple submits
              >
                {/* Show 'saving' label during submit, else regular submit label */}
                {isSubmitting ? t('saving') : t('roleUpgrade.submitRequest')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}