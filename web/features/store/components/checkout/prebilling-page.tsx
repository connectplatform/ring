'use client'

// ===================
// Imports & Setup
// ===================

// Import core React hooks and features
import React, { useState, useEffect } from 'react'
// Preferences load via useEffect — do NOT call use() inside try/catch or with uncached promises.

// Feature, UI, and model imports
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/use-auth'
import { UserRolesArray } from '@/features/auth/user-role'
import { useStorePaymentMethods } from '@/features/store/currency-context'
import UnifiedLoginInline from '@/features/auth/components/unified-login-inline'
import { AddressManager } from './address-manager'
import ShippingMethodSelector from './shipping-method-selector'
import type { ShippingMethod } from './shipping-method-selector'
import { PaymentStep, type PaymentMethod } from './payment-step'
import { normalizePaymentRail } from '@/lib/payments/conductor/types'
import { SecurityBadges } from './security-badges'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { User, Mail, Phone, CreditCard, ChevronsUpDown } from 'lucide-react'
import type { UserAddress } from '@/features/store/services/address-service'
import type { NovaPostLocation } from '@/features/store/components/shipping/nova-post-selector'
import { 
  getUserStorePreferences,
  updateShippingPreference,
  updatePaymentPreference,
  updateLastUsedAddress
} from '@/app/_actions/store-preferences-actions'
import { getMainCurrencySymbol, getSupportedCurrencies, getSupportedCrypto } from '@/lib/ring-config-core'
import type { SupportedCurrencies, SupportedCrypto } from '@/lib/ring-config-types'
import type { StorePaymentMethods } from '@/features/store/types'
import {
  DavinciDroplist,
  DavinciDroplistItem,
  DavinciDroplistTrigger,
} from '@/components/ui/davinci-droplist'

const FIAT_PRESENTMENT: SupportedCurrencies[] = getSupportedCurrencies()
const CRYPTO_PRESENTMENT: SupportedCrypto[] = getSupportedCrypto()
const MAIN_CURRENCY_CODE = getMainCurrencySymbol() as SupportedCurrencies

// ===================
// Interfaces & Types
// ===================

// Props for the checkout page component (cart, currency, callback, etc)
interface PrebillingPageProps {
  cartItems: any[]
  cartTotal: {
    [key in StorePaymentMethods]: number
  }
  currency: StorePaymentMethods
  mainCurrency: StorePaymentMethods
  onProceedToPayment: (billingData: BillingData) => void
  returnTo?: string
}

// Structure sent to payment system on "Proceed"
export interface BillingData {
  firstName: string
  lastName: string
  email: string
  phone: string
  shippingAddress: UserAddress
  shippingMethod: ShippingMethod
  shippingLocation?: NovaPostLocation | null
  paymentMethod: PaymentMethod
  billingAddressSameAsShipping: boolean
  billingAddress?: UserAddress
  savePaymentMethod: boolean
  marketingOptIn: boolean
  /** Fiat presentment for card/paypal — server recomputes charge amount. */
  paymentCurrency?: SupportedCurrencies
}

// ===========================
// Main Checkout Component
// ===========================
export function PrebillingPage({ 
  cartItems, 
  cartTotal, 
  onProceedToPayment,
  returnTo 
}: PrebillingPageProps) {
  // Translation util for i18n
  const t = useTranslations('modules.store.checkout')

  // Auth state, user details, and visitor role
  const { user, role, isAuthenticated } = useAuth()

  // Currency conversion, formats, current visible currency (provider required on checkout)
  const {
    convertPrice,
    formatPrice: formatCurrencyPrice,
    currency: activeCurrency,
    mainCurrency,
    displayMode,
    setCurrency,
  } = useStorePaymentMethods()

  /** Left-rail mode drives pool: fiats vs configured crypto symbols. */
  const presentmentPool: StorePaymentMethods[] =
    displayMode === 'native_token' ? [...CRYPTO_PRESENTMENT] : [...FIAT_PRESENTMENT]

  // ==========================================
  // UI/Form State (User, Address, Preferences)
  // ==========================================

  // TODO: Codemod suggestion - migrate all input fields to React 19 native form state API

  // User identity fields
  const [firstName, setFirstName] = useState('')    // User's first name input value
  const [lastName, setLastName] = useState('')      // Last name input value
  const [email, setEmail] = useState('')            // Email input value
  const [phone, setPhone] = useState('')            // Phone input value (optional)

  // Shipping state for selected address, method, and NovaPost location
  const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(null)   // User's selected shipping address
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('pickup')  // Default pickup (Nova Post optional)
  const [shippingLocation, setShippingLocation] = useState<NovaPostLocation | null>(null) // NovaPost office branch

  // Payment state for user's choices (method, addresses)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')     // Default: Card (PaymentConductor)
  const [billingAddressSameAsShipping, setBillingAddressSameAsShipping] = useState(true) // Billing = shipping
  const [selectedBillingAddress, setSelectedBillingAddress] = useState<UserAddress | null>(null) // Separate billing if needed

  // Presentment selection — card/paypal charge stays fiat (main or last fiat pick).
  const defaultPaymentCurrency: SupportedCurrencies =
    FIAT_PRESENTMENT.includes(activeCurrency as SupportedCurrencies)
      ? (activeCurrency as SupportedCurrencies)
      : MAIN_CURRENCY_CODE
  const [paymentCurrency, setPaymentCurrency] = useState<SupportedCurrencies>(defaultPaymentCurrency)
  const [currencyDroplistOpen, setCurrencyDroplistOpen] = useState(false)
  const [currencySearch, setCurrencySearch] = useState('')

  // Preferences and subscriptions
  const [savePaymentMethod, setSavePaymentMethod] = useState(false)                  // Save card on file pref 
  const [marketingOptIn, setMarketingOptIn] = useState(false)                        // User marketing opt-in

  // For async UI/submit
  const [isLoading, setIsLoading] = useState(false)                                  // Spinner during async calls
  const [userPreferences, setUserPreferences] = useState<
    Awaited<ReturnType<typeof getUserStorePreferences>> | null
  >(null)

  // Load preferences after auth — never use() with an uncached server-action promise in try/catch.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setUserPreferences(null)
      return
    }
    let cancelled = false
    void getUserStorePreferences()
      .then((prefs) => {
        if (!cancelled) setUserPreferences(prefs)
      })
      .catch(() => {
        if (!cancelled) setUserPreferences(null)
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, user?.id])

  // ======================
  // Autofill user info and preferences on auth or pref change
  // ======================

  useEffect(() => {
    if (isAuthenticated && user) {
      // Attempt to parse first/last names from user info if available
      if (user.name) {
        const nameParts = user.name.split(' ')
        setFirstName(nameParts[0] || '')
        setLastName(nameParts.slice(1).join(' ') || '')
      }
      setEmail(user.email || '')

      // Hydrate store preferences if available
      if (userPreferences) {
        // Select stored shipping method if set
        if (
          userPreferences.preferredShippingMethod &&
          userPreferences.preferredShippingMethod !== 'manual'
        ) {
          setShippingMethod(userPreferences.preferredShippingMethod)
        }
        if (userPreferences.preferredPaymentMethod) {
          setPaymentMethod(
            normalizePaymentRail(userPreferences.preferredPaymentMethod) as PaymentMethod,
          )
        }
        if (
          userPreferences.preferredDisplayCurrency &&
          FIAT_PRESENTMENT.includes(userPreferences.preferredDisplayCurrency)
        ) {
          setPaymentCurrency(userPreferences.preferredDisplayCurrency)
        }
        // Load "save payment method" pref, default to false if unset
        setSavePaymentMethod(userPreferences.savePaymentMethods ?? false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, userPreferences])

  // ===========================
  // Address and Preference Handlers
  // ===========================

  // Selected address from address manager
  const handleAddressSelect = (address: UserAddress) => {
    setSelectedAddress(address)
    // After successful client update, persist selection backend if user is logged in
    if (user?.id && address.id) {
      updateLastUsedAddress(address.id).catch(error => {
        // Log silent, non-blocking
        console.error('Failed to update last used address:', error)
      })
    }
  }

  // When user changes shipping method, persist to store
  const handleShippingMethodChange = (method: ShippingMethod) => {
    setShippingMethod(method)
    if (user?.id) {
      updateShippingPreference(method).catch(error => {
        console.error('Failed to update shipping preference:', error)
      })
    }
  }

  // Changing payment method and persist
  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setPaymentMethod(method)
    if (user?.id) {
      updatePaymentPreference(method).catch(error => {
        console.error('Failed to update payment preference:', error)
      })
    }
  }

  // ===========================
  // Proceed to Payment Handler
  // ===========================

  // Called on "Proceed" click: validates, builds billing payload, and passes upstream
  const handleProceed = async () => {
    // Validation: check address present
    if (!selectedAddress) {
      alert(t('pleaseSelectAddress'))
      return
    }
    // If nova-post, branch selection is also required
    if (shippingMethod === 'nova-post' && !shippingLocation) {
      alert(t('pleaseSelectNovaPostLocation'))
      return
    }

    setIsLoading(true) // UI blocks for network

    // Compose billingData as required by payment backend
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
      marketingOptIn,
      paymentCurrency,
    }

    // Pass to caller callback, handle errors gracefully
    try {
      await onProceedToPayment(billingData)
    } catch (error) {
      // Log only; UI can provide user error message in production
      console.error('Failed to proceed to payment:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // ===========================
  // Validation
  // ===========================

  // Check if checkout is ready for submission: must have all key fields
  // TODO: Codemod: Migrate to Zod or Yup for schema-driven validation (add feedback for user)
  const isFormValid = selectedAddress && 
    firstName.trim() && 
    lastName.trim() && 
    email.trim() &&
    (shippingMethod !== 'nova-post' || shippingLocation)

  // ===========================
  // Main Render (JSX UI)
  // ===========================
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* ===== Left column: Main Checkout Steps ===== */}
        <div className="space-y-8">

          {/* 
            Authentication Step:
            - If user is a non-logged "visitor", prompt login for faster checkout.
            - Provide option to skip for guest flow.
          */}
          {role === UserRolesArray.visitor && (
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

          {/* 
            Contact / Identity panel
            - Always shown; if logged in, disables (locks) email field
          */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                {t('contactInformation')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* First and last name split into two columns on desktop */}
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
              {/* Email, locks to user account if authenticated */}
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
              {/* Optional phone number */}
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

          {/* 
            Address entry step
            - Authenticated users: show AddressManager (stored addresses selector)
            - Guests/visitors: display stubbed address fields (to be implemented)
          */}
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

          {!isAuthenticated && (
            <Card>
              <CardHeader>
                <CardTitle>{t('shippingAddress')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 
                  // STUB: Guest checkout address entry (not implemented)
                  // TODO: Step 1: Add useState for guest address fields: street, city, postal, etc.
                  // TODO: Step 2: In handleProceed, assemble UserAddress object from these guest fields; call setSelectedAddress before validation.
                  // TODO: Step 3: Replace these input chunks using React 19's useForm or a 3rd party form lib for validation/registration.
                  // TODO: Step 4: Implement form validation UI for errors, required fields, etc. (use Zod/Yup or React 19 form validation)
                  // TODO: Step 5: Remove AddressManager (should stay hidden for guests).
                */}
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

          {/* 
            Shipping method picker (pickup, nova-post, etc)
            - If 'nova-post', will also let user select a NP branch/location
          */}
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

          {/* 
            Payment method picker; also manages address/billing and "save for future" 
          */}
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
              {/* 
                Billing address toggle
                // STUB: UI for separate billing address not yet implemented
                // TODO: Add form section for specifying billing address if unchecked
              */}
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
                {/* "Save payment"—only for authenticated */}
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

          {/* Marketing Opt-In: Checkbox for user's consent for offers/news */}
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

        {/* ===== Right column: Cart/Order Summary, Security, Proceed ===== */}
        <div className="space-y-6">

          {/* Cart/Order summary panel */}
          <Card>
            <CardHeader>
              <CardTitle>{t('orderSummary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 
                Cart listing:
                - Shows product, variants, per-product price breakdown, line total
              */}
              <div className="space-y-3">
                {cartItems.map((item, index) => {
                  // Determine unit price (allowing override by chosen option/variant)
                  const displayPrice = item.finalPrice || parseFloat(item.product.price)
                  const itemTotal = displayPrice * item.quantity

                  return (
                    <div key={index} className="flex justify-between items-start text-sm pb-3 border-b last:border-b-0 last:pb-0">
                      <div className="flex-1">
                        <div className="font-medium">{item.product.name}</div>

                        {/* Show variant chips if present (ex: Color: Green) */}
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
                        {/* Show qty and unit price */}
                        <div className="text-muted-foreground mt-1">
                          {t('quantity')}: {item.quantity} × {formatCurrencyPrice(
                            convertPrice(
                              displayPrice,
                              item.product.currency as StorePaymentMethods,
                              activeCurrency
                            ),
                            activeCurrency
                          )}
                        </div>
                      </div>
                      <div className="font-medium ml-4">
                        {formatCurrencyPrice(
                          convertPrice(itemTotal, item.product.currency as StorePaymentMethods, activeCurrency),
                          activeCurrency
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <Separator />

              {/* 
                Order totals breakdown:
                - Subtotal, shipping cost estimate, grand total
                - TODO: Codemod to integrate w/ dynamic shipping logic when switching to React 19/Next 16 config
              */}
              {(() => {
                // Cart totals are stored in main currency; convert for display / presentment.
                const mainKey = (mainCurrency || MAIN_CURRENCY_CODE) as StorePaymentMethods
                let subtotalMain = 0
                if (typeof cartTotal === 'object' && cartTotal !== null) {
                  subtotalMain =
                    cartTotal[mainKey] ??
                    cartTotal[MAIN_CURRENCY_CODE as StorePaymentMethods] ??
                    Object.values(cartTotal).find((v) => typeof v === 'number') ??
                    0
                } else {
                  subtotalMain = typeof cartTotal === 'number' ? cartTotal : 0
                }

                let shippingCostMain = 0
                if (shippingMethod === 'pickup') {
                  shippingCostMain = 0
                } else {
                  shippingCostMain = 65
                }

                const grandTotalMain = subtotalMain + shippingCostMain
                const showPresentment = paymentMethod === 'card' || paymentMethod === 'paypal'
                const displayCode: StorePaymentMethods = showPresentment
                  ? (displayMode === 'native_token'
                      ? activeCurrency
                      : paymentCurrency)
                  : activeCurrency
                const filteredCurrencies = presentmentPool.filter((c) =>
                  c.toLowerCase().includes(currencySearch.trim().toLowerCase()),
                )

                return (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>{t('subtotal')}</span>
                      <span>
                        {formatCurrencyPrice(
                          convertPrice(subtotalMain, mainKey, displayCode),
                          displayCode,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('shipping')}</span>
                      <span>
                        {shippingMethod === 'pickup'
                          ? t('free')
                          : formatCurrencyPrice(
                              convertPrice(shippingCostMain, mainKey, displayCode),
                              displayCode,
                            )}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-3 font-semibold text-lg">
                      <span>{t('total')}</span>
                      <div className="flex items-center gap-2">
                        {showPresentment ? (
                          <DavinciDroplist
                            open={currencyDroplistOpen}
                            onOpenChange={setCurrencyDroplistOpen}
                            scopeLabel={t('paymentCurrency') || 'Currency'}
                            search={currencySearch}
                            onSearchChange={setCurrencySearch}
                            empty={filteredCurrencies.length === 0}
                            emptyMessage={t('noCurrencies') || 'No currencies'}
                            trigger={
                              <DavinciDroplistTrigger
                                open={currencyDroplistOpen}
                                onClick={() => setCurrencyDroplistOpen(true)}
                                className="h-9 w-[7.5rem] shrink-0"
                              >
                                <span className="truncate">
                                  {displayMode === 'native_token' ? activeCurrency : paymentCurrency}
                                </span>
                                <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                              </DavinciDroplistTrigger>
                            }
                          >
                            {filteredCurrencies.map((code) => (
                              <DavinciDroplistItem
                                key={code}
                                selected={
                                  displayMode === 'native_token'
                                    ? code === activeCurrency
                                    : code === paymentCurrency
                                }
                                onSelect={() => {
                                  if (FIAT_PRESENTMENT.includes(code as SupportedCurrencies)) {
                                    setPaymentCurrency(code as SupportedCurrencies)
                                  }
                                  setCurrency(code)
                                  setCurrencyDroplistOpen(false)
                                  setCurrencySearch('')
                                }}
                              >
                                {code}
                              </DavinciDroplistItem>
                            ))}
                          </DavinciDroplist>
                        ) : null}
                        <span>
                          {formatCurrencyPrice(
                            convertPrice(grandTotalMain, mainKey, displayCode),
                            displayCode,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          {/* Payment security badges section */}
          <SecurityBadges />

          {/* 
            Final "Proceed to Payment" button.
            - Blocks (disables) unless form is valid and not loading.
            - Spinner is shown during async API call.
          */}
          <Button
            onClick={handleProceed}
            disabled={!isFormValid || isLoading}
            className="w-full h-12 text-lg mb-20 md:mb-0"
          >
            {/* Spinner or proceed call-to-action */}
            {isLoading ? t('processing') : t('proceedToPayment')}
          </Button>
        </div>
      </div>
    </div>
  )
}
