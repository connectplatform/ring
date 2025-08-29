'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Edit2, Trash2, MapPin, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { UserAddress } from '@/features/store/services/address-service'
import { AddressFormModal } from './address-form-modal'
import { 
  getUserAddresses, 
  createUserAddress, 
  updateUserAddress, 
  deleteUserAddress, 
  setDefaultUserAddress 
} from '@/app/_actions/store-address-actions'

interface AddressManagerProps {
  userId: string
  selectedAddressId?: string
  onAddressSelect: (address: UserAddress) => void
  onAddressChange?: () => void
}

export function AddressManager({ 
  userId, 
  selectedAddressId, 
  onAddressSelect,
  onAddressChange 
}: AddressManagerProps) {
  const t = useTranslations('modules.store.checkout')
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null)

  const loadAddresses = async () => {
    try {
      setLoading(true)
      const userAddresses = await getUserAddresses()
      setAddresses(userAddresses)
    } catch (error) {
      console.error('Failed to load addresses:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAddresses()
  }, [userId])

  const handleAddressCreated = async (address: Omit<UserAddress, 'id'>) => {
    try {
      // Create FormData for server action
      const formData = new FormData()
      Object.entries(address).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, String(value))
        }
      })
      
      const result = await createUserAddress(null, formData)
      if (result.success) {
        await loadAddresses()
        setShowForm(false)
        onAddressChange?.()
      } else {
        console.error('Failed to create address:', result.error)
      }
    } catch (error) {
      console.error('Failed to create address:', error)
    }
  }

  const handleAddressUpdated = async (addressId: string, address: Partial<UserAddress>) => {
    try {
      // Create FormData for server action
      const formData = new FormData()
      formData.append('id', addressId)
      Object.entries(address).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, String(value))
        }
      })
      
      const result = await updateUserAddress(null, formData)
      if (result.success) {
        await loadAddresses()
        setEditingAddress(null)
        onAddressChange?.()
      } else {
        console.error('Failed to update address:', result.error)
      }
    } catch (error) {
      console.error('Failed to update address:', error)
    }
  }

  const handleDeleteAddress = async (addressId: string) => {
    if (confirm(t('confirmDeleteAddress'))) {
      try {
        const formData = new FormData()
        formData.append('id', addressId)
        
        const result = await deleteUserAddress(null, formData)
        if (result.success) {
          await loadAddresses()
          onAddressChange?.()
        } else {
          console.error('Failed to delete address:', result.error)
        }
      } catch (error) {
        console.error('Failed to delete address:', error)
      }
    }
  }

  const handleSetDefault = async (addressId: string) => {
    try {
      const formData = new FormData()
      formData.append('id', addressId)
      
      const result = await setDefaultUserAddress(null, formData)
      if (result.success) {
        await loadAddresses()
        onAddressChange?.()
      } else {
        console.error('Failed to set default address:', result.error)
      }
    } catch (error) {
      console.error('Failed to set default address:', error)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-gray-200 h-20 rounded-lg"></div>
        <div className="animate-pulse bg-gray-200 h-20 rounded-lg"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('shippingAddress')}</h3>
        <Button
          onClick={() => setShowForm(true)}
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('addNewAddress')}
        </Button>
      </div>

      {addresses.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t('noAddressesFound')}</p>
          <Button
            onClick={() => setShowForm(true)}
            className="mt-4"
          >
            {t('addFirstAddress')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <div
              key={address.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedAddressId === address.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onAddressSelect(address)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">{address.fullName}</span>
                    {address.isDefault && (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        {t('default')}
                      </span>
                    )}
                    {selectedAddressId === address.id && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>{address.addressLine1}</p>
                    {address.addressLine2 && <p>{address.addressLine2}</p>}
                    <p>
                      {address.city && `${address.city}, `}
                      {address.postalCode && `${address.postalCode}, `}
                      {address.country}
                    </p>
                    {address.phone && <p>{address.phone}</p>}
                  </div>
                </div>
                
                <div className="flex items-center gap-1 ml-4">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingAddress(address)
                    }}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteAddress(address.id!)
                    }}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  
                  {!address.isDefault && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSetDefault(address.id!)
                      }}
                      size="sm"
                      variant="outline"
                      className="ml-2 text-xs"
                    >
                      {t('setDefault')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Address Modal */}
      {showForm && (
        <AddressFormModal
          onClose={() => setShowForm(false)}
          onSubmit={handleAddressCreated}
          title={t('addNewAddress')}
        />
      )}

      {/* Edit Address Modal */}
      {editingAddress && (
        <AddressFormModal
          onClose={() => setEditingAddress(null)}
          onSubmit={(data) => handleAddressUpdated(editingAddress.id!, data)}
          initialData={editingAddress}
          title={t('editAddress')}
        />
      )}
    </div>
  )
}
