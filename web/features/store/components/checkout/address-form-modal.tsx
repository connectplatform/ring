'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { UserAddress } from '@/features/store/services/address-service'

interface AddressFormModalProps {
  onClose: () => void
  onSubmit: (address: Omit<UserAddress, 'id' | 'createdAt' | 'updatedAt'>) => void
  initialData?: UserAddress
  title: string
}

export function AddressFormModal({ 
  onClose, 
  onSubmit, 
  initialData, 
  title 
}: AddressFormModalProps) {
  const t = useTranslations('modules.store.checkout')
  const [formData, setFormData] = useState<Omit<UserAddress, 'id' | 'createdAt' | 'updatedAt'>>({
    fullName: initialData?.fullName || '',
    phone: initialData?.phone || '',
    country: initialData?.country || 'Ukraine',
    city: initialData?.city || '',
    postalCode: initialData?.postalCode || '',
    addressLine1: initialData?.addressLine1 || '',
    addressLine2: initialData?.addressLine2 || '',
    isDefault: initialData?.isDefault || false
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.fullName.trim() || !formData.addressLine1.trim()) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(formData)
    } catch (error) {
      console.error('Error submitting address:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <Button
            onClick={onClose}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">{t('fullName')} *</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={handleInputChange('fullName')}
              placeholder={t('enterFullName')}
              required
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">{t('phone')}</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={handleInputChange('phone')}
              placeholder="+380..."
            />
          </div>

          {/* Country */}
          <div className="space-y-2">
            <Label htmlFor="country">{t('country')}</Label>
            <Input
              id="country"
              value={formData.country}
              onChange={handleInputChange('country')}
              placeholder={t('enterCountry')}
            />
          </div>

          {/* City */}
          <div className="space-y-2">
            <Label htmlFor="city">{t('city')}</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={handleInputChange('city')}
              placeholder={t('enterCity')}
            />
          </div>

          {/* Postal Code */}
          <div className="space-y-2">
            <Label htmlFor="postalCode">{t('postalCode')}</Label>
            <Input
              id="postalCode"
              value={formData.postalCode}
              onChange={handleInputChange('postalCode')}
              placeholder="12345"
            />
          </div>

          {/* Address Line 1 */}
          <div className="space-y-2">
            <Label htmlFor="addressLine1">{t('addressLine1')} *</Label>
            <Input
              id="addressLine1"
              value={formData.addressLine1}
              onChange={handleInputChange('addressLine1')}
              placeholder={t('enterStreetAddress')}
              required
            />
          </div>

          {/* Address Line 2 */}
          <div className="space-y-2">
            <Label htmlFor="addressLine2">{t('addressLine2')}</Label>
            <Input
              id="addressLine2"
              value={formData.addressLine2}
              onChange={handleInputChange('addressLine2')}
              placeholder={t('enterApartmentUnit')}
            />
          </div>

          {/* Default Address Switch */}
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="isDefault">{t('setAsDefault')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('defaultAddressDescription')}
              </p>
            </div>
            <Switch
              id="isDefault"
              checked={formData.isDefault}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, isDefault: checked }))
              }
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={isSubmitting}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting || !formData.fullName.trim() || !formData.addressLine1.trim()}
            >
              {isSubmitting ? t('saving') : t('saveAddress')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
