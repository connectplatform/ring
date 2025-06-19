"use client"

import React, { useState } from "react"
import { useTranslation } from "@/node_modules/react-i18next"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { UserRole, type AuthUser, type RoleUpgradeRequest, UpgradeRequestStatus } from "@/features/auth/types"

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
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData(event.currentTarget)
      const requestData: Partial<RoleUpgradeRequest> = {
        userId: user.id,
        fromRole: user.role,
        toRole: UserRole.MEMBER,
        status: UpgradeRequestStatus.PENDING,
        reason: formData.get('reason') as string,
        organization: formData.get('organization') as string || undefined,
        position: formData.get('position') as string || undefined,
        linkedinProfile: formData.get('linkedinProfile') as string || undefined,
        portfolioUrl: formData.get('portfolioUrl') as string || undefined,
        submittedAt: new Date()
      }

      await onSubmit(requestData)
      setSuccess(true)
      
      // Close modal after 2 seconds
      setTimeout(() => {
        onClose()
        setSuccess(false)
      }, 2000)

    } catch (error) {
      console.error('Error submitting upgrade request:', error)
      setError('Failed to submit upgrade request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
      setError(null)
      setSuccess(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('roleUpgrade.title')}</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center">
            <Alert>
              <AlertTitle>{t('roleUpgrade.requestSubmitted')}</AlertTitle>
            </Alert>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('roleUpgrade.currentRole')}</Label>
                <Input value={user.role} disabled />
              </div>
              <div className="space-y-2">
                <Label>{t('roleUpgrade.requestedRole')}</Label>
                <Input value="member" disabled />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">{t('roleUpgrade.reason')} *</Label>
              <Textarea
                id="reason"
                name="reason"
                required
                rows={3}
                placeholder="Please explain why you would like to upgrade your account..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization">{t('roleUpgrade.organization')}</Label>
              <Input
                id="organization"
                name="organization"
                type="text"
                placeholder="Your company or organization name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">{t('roleUpgrade.position')}</Label>
              <Input
                id="position"
                name="position"
                type="text"
                placeholder="Your job title or position"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedinProfile">{t('roleUpgrade.linkedinProfile')}</Label>
              <Input
                id="linkedinProfile"
                name="linkedinProfile"
                type="url"
                placeholder="https://linkedin.com/in/yourprofile"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="portfolioUrl">{t('roleUpgrade.portfolioUrl')}</Label>
              <Input
                id="portfolioUrl"
                name="portfolioUrl"
                type="url"
                placeholder="https://yourportfolio.com"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('saving') : t('roleUpgrade.submitRequest')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
} 