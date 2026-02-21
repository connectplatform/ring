'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/use-auth'
import { UserRole } from '@/features/auth/types'
import { useOptionalCurrency } from '@/features/store/currency-context'
import UnifiedLoginInline from '@/features/auth/components/unified-login-inline'
import { AddressManager } from './address-manager'
import { ShippingMethodSelector, type ShippingMethod } from './shipping-method-selector'
import { PaymentStep, type PaymentMethod } from './payment-step'
import { SecurityBadges } from './security-badges'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { User, Mail, Phone, CreditCard } from 'lucide-react'
import type { UserAddress } from '@/features/store/services/address-service'
import type { NovaPostLocation } from '@/features/store/components/shipping/nova-post-selector'
import { 
  getUserStorePreferences,
  updateShippingPreference,
  updatePaymentPreference,
  updateLastUsedAddress
} from '@/app/_actions/store-preferences-actions'

interface PrebillingPageProps {
  cartItems: any[]
  cartTotal: number
  onProceedToPayment: (billingData: BillingData) => void
  returnTo?: string
}

export interface BillingData {
  // User info
  firstName: string
  lastName: string
  email: string
  phone: string
  
  // Shipping
  shippingAddress: UserAddress
  shippingMethod: ShippingMethod
  shippingLocation?: NovaPostLocation | null
  
  // Payment
  paymentMethod: PaymentMethod
  billingAddressSameAsShipping: boolean
  billingAddress?: UserAddress
  
  // Preferences
  savePaymentMethod: boolean
  marketingOptIn: boolean
}

export function PrebillingPage({ 
  cartItems, 
  cartTotal, 
  onProceedToPayment,
  returnTo 
}: PrebillingPageProps) {
  const t = useTranslations('modules.store.checkout')
  const { user, role, isAuthenticated } = useAuth()
  const currencyContext = useOptionalCurrency()
  
  // Currency conversion helpers
  const convertPrice = currencyContext?.convertPrice || ((price: number) => price)
  const formatPrice = currencyContext?.formatPrice || ((price: number) => `${price.toFixed(2)} ₴`)
  
  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  
  // Shipping state
  const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(null)
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('nova-post')
  const [shippingLocation, setShippingLocation] = useState<NovaPostLocation | null>(null)
  
  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wayforpay')
  const [billingAddressSameAsShipping, setBillingAddressSameAsShipping] = useState(true)
  const [selectedBillingAddress, setSelectedBillingAddress] = useState<UserAddress | null>(null)
  
  // Preferences state
  const [savePaymentMethod, setSavePaymentMethod] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false)

  // Auto-fill user data when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      // Split name into first and last if available
      if (user.name) {
        const nameParts = user.name.split(' ')
        setFirstName(nameParts[0] || '')
        setLastName(nameParts.slice(1).join(' ') || '')
      }
      setEmail(user.email || '')
      // Load user preferences
      loadUserPreferences()
    }
  }, [isAuthenticated, user])

  const loadUserPreferences = async () => {
    if (!user?.id) return
    
    try {
      const prefs = await getUserStorePreferences()
      if (prefs) {
        if (prefs.preferredShippingMethod) {
          setShippingMethod(prefs.preferredShippingMethod)
        }
        if (prefs.preferredPaymentMethod) {
          setPaymentMethod(prefs.preferredPaymentMethod)
        }
        setSavePaymentMethod(prefs.savePaymentMethods ?? false)
      }
    } catch (error) {
      console.error('Failed to load user preferences:', error)
    }
  }

  const handleAddressSelect = (address: UserAddress) => {
    setSelectedAddress(address)
    // Update user preferences
    if (user?.id && address.id) {
      updateLastUsedAddress(address.id).catch(error => {
        console.error('Failed to update last used address:', error)
      })
    }
  }

  const handleShippingMethodChange = (method: ShippingMethod) => {
    setShippingMethod(method)
    // Update user preferences
    if (user?.id) {
      updateShippingPreference(method).catch(error => {
        console.error('Failed to update shipping preference:', error)
      })
    }
  }

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setPaymentMethod(method)
    // Update user preferences
    if (user?.id) {
      updatePaymentPreference(method).catch(error => {
        console.error('Failed to update payment preference:', error)
      })
    }
  }

  const handleProceed = async () => {
    if (!selectedAddress) {
      alert(t('pleaseSelectAddress'))
      return
    }

    if (shippingMethod === 'nova-post' && !shippingLocation) {
      alert(t('pleaseSelectNovaPostLocation'))
      return
    }

    setIsLoading(true)

    const billingData: BillingData = {
      firstName,
      lastName,
      email,
      phone,
      shippingAddress: selectedAddress,
      shippingMethod,
      shippingLocation,
      paymentMethod,
      billingAddressSameAsShipping,
      billingAddress: billingAddressSameAsShipping ? selectedAddress : selectedBillingAddress,
      savePaymentMethod,
      marketingOptIn
    }

    try {
      await onProceedToPayment(billingData)
    } catch (error) {
      console.error('Failed to proceed to payment:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid = selectedAddress && 
    firstName.trim() && 
    lastName.trim() && 
    email.trim() &&
    (shippingMethod !== 'nova-post' || shippingLocation)

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Main Content */}
        <div className="space-y-8">
          
          {/* Authentication Section for Visitors */}
          {role === UserRole.VISITOR && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {t('loginForFasterCheckout')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UnifiedLoginInline 
                  from={returnTo}
                  variant="default"
                />
                <div className="mt-4 text-center">
                  <span className="text-sm text-gray-500">
                    {t('orContinueAsGuest')}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                {t('contactInformation')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t('firstName')} *</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={t('enterFirstName')}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t('lastName')} *</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder={t('enterLastName')}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')} *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('enterEmail')}
                  disabled={isAuthenticated}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">{t('phone')}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+380..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          {isAuthenticated && user && (
            <Card>
              <CardContent className="p-6">
                <AddressManager
                  userId={user.id}
                  selectedAddressId={selectedAddress?.id}
                  onAddressSelect={handleAddressSelect}
                />
              </CardContent>
            </Card>
          )}

          {/* Guest Address Input */}
          {!isAuthenticated && (
            <Card>
              <CardHeader>
                <CardTitle>{t('shippingAddress')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="guestAddress">{t('addressLine1')} *</Label>
                  <Input
                    id="guestAddress"
                    placeholder={t('enterStreetAddress')}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="guestCity">{t('city')} *</Label>
                    <Input
                      id="guestCity"
                      placeholder={t('enterCity')}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guestPostalCode">{t('postalCode')}</Label>
                    <Input
                      id="guestPostalCode"
                      placeholder="12345"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Shipping Method */}
          <Card>
            <CardContent className="p-6">
              <ShippingMethodSelector
                selectedMethod={shippingMethod}
                onMethodSelect={handleShippingMethodChange}
                selectedLocation={shippingLocation}
                onLocationSelect={setShippingLocation}
              />
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t('paymentInformation')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentStep
                method={paymentMethod}
                setMethod={handlePaymentMethodChange}
              />
              
              {/* Billing Address Option */}
              <div className="mt-6 space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sameBillingAddress"
                    checked={billingAddressSameAsShipping}
                    onCheckedChange={(checked) => setBillingAddressSameAsShipping(!!checked)}
                  />
                  <Label htmlFor="sameBillingAddress" className="text-sm">
                    {t('billingAddressSameAsShipping')}
                  </Label>
                </div>
                
                {/* Save Payment Method */}
                {isAuthenticated && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="savePaymentMethod"
                      checked={savePaymentMethod}
                      onCheckedChange={(checked) => setSavePaymentMethod(!!checked)}
                    />
                    <Label htmlFor="savePaymentMethod" className="text-sm">
                      {t('savePaymentMethodForFuture')}
                    </Label>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Marketing Opt-in */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="marketingOptIn"
                  checked={marketingOptIn}
                  onCheckedChange={(checked) => setMarketingOptIn(!!checked)}
                />
                <Label htmlFor="marketingOptIn" className="text-sm">
                  {t('marketingOptIn')}
                </Label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('orderSummary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cart Items */}
              <div className="space-y-3">
                {cartItems.map((item, index) => {
                  // Phase 2: Use finalPrice if available (includes variant modifiers)
                  const displayPrice = item.finalPrice || parseFloat(item.product.price)
                  const itemTotal = displayPrice * item.quantity
                  
                  return (
                    <div key={index} className="flex justify-between items-start text-sm pb-3 border-b last:border-b-0 last:pb-0">
                      <div className="flex-1">
                        <div className="font-medium">{item.product.name}</div>
                        
                        {/* Phase 2: Display selected variants */}
                        {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(item.selectedVariants).map(([name, value]) => (
                              <span 
                                key={name}
                                className="inline-flex items-center px-1.5 py-0.5 bg-muted rounded text-xs"
                              >
                                {name}: <span className="ml-0.5 font-medium">{String(value)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        
                        <div className="text-muted-foreground mt-1">
                          {t('quantity')}: {item.quantity} × {formatPrice(convertPrice(displayPrice))}
                        </div>
                      </div>
                      <div className="font-medium ml-4">
                        {formatPrice(convertPrice(itemTotal))}
                      </div>
                    </div>
                  )
                })}
              </div>
              
              <Separator />
              
              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>{t('subtotal')}</span>
                  <span>{formatPrice(convertPrice(cartTotal))}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('shipping')}</span>
                  <span>
                    {shippingMethod === 'pickup' ? t('free') : formatPrice(convertPrice(65))}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>{t('total')}</span>
                  <span>
                    {formatPrice(convertPrice(cartTotal + (shippingMethod === 'pickup' ? 0 : 65)))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Assurance */}
          <SecurityBadges />

          {/* Proceed Button */}
          <Button
            onClick={handleProceed}
            disabled={!isFormValid || isLoading}
            className="w-full h-12 text-lg mb-20 md:mb-0"
          >
            {isLoading ? t('processing') : t('proceedToPayment')}
          </Button>
        </div>
      </div>
    </div>
  )
}
