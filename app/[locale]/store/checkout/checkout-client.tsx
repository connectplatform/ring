'use client'

import React, { useState, useEffect, useMemo, useActionState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { useStore } from '@/features/store/context'
import { PrebillingPage, type BillingData } from '@/features/store/components/checkout/prebilling-page'
import { ReviewStep } from '@/features/store/components/checkout/review-step'
import type { Locale } from '@/i18n/shared'
import { useTranslations } from 'next-intl'
import { useToast } from '@/hooks/use-toast'
import { stashReferralCheckoutFlash } from '@/features/refcodes/lib/checkout-referral-flash'
import { SpecialOfferModal } from '@/features/store/components/special-offer-modal'
import type { StorePaymentMethods } from '@/features/store/types'
import { getMainCurrencySymbol } from '@/lib/ring-config-core'
import { flattenShippingAddress } from '@/features/store/lib/flatten-shipping-address'
import { isCheckoutSpecialOfferEnabledForVendors } from '@/app/_actions/vendor-actions'
import { followCheckoutResult } from '@/lib/payments/checkout-redirect'
import { normalizePaymentRail } from '@/lib/payments/conductor/types'
import {
  placeAndPayStoreOrder,
  type PlaceAndPayStoreOrderState,
} from '@/app/_actions/store-checkout-payment'
import { useFormStatus } from 'react-dom'

export default function CheckoutClient({ locale }: { locale: Locale }) {
  const router = useRouter()
  const [orderId, setOrderId] = useState<string | null>(null)
  const { cartItems, clearCart } = useStore()
  const [step, setStep] = useState<'prebilling' | 'review' | 'confirmation'>('prebilling')
  const [billingData, setBillingData] = useState<BillingData | null>(null)
  const t = useTranslations('modules.store.checkout')
  const { success: toastSuccess } = useToast()
  const [showOffer, setShowOffer] = useState(false)
  const handledStateRef = useRef<PlaceAndPayStoreOrderState | null>(null)
  const currency = getMainCurrencySymbol()
  const billingRef = useRef(billingData)
  const cartRef = useRef(cartItems)
  billingRef.current = billingData
  cartRef.current = cartItems

  const placeOrderAction = async (
    _prev: PlaceAndPayStoreOrderState | null,
    _fd: FormData,
  ): Promise<PlaceAndPayStoreOrderState> => {
    const billing = billingRef.current
    if (!billing) return { error: 'Missing billing data' }

    const shippingFlat = flattenShippingAddress(billing.shippingAddress)
    const billingFlat = billing.billingAddressSameAsShipping
      ? shippingFlat
      : flattenShippingAddress(billing.billingAddress)

    const items = cartRef.current.map((i) => ({
      productId: i.product.id,
      name: i.product.name,
      price: String(i.product.price),
      currency,
      quantity: i.quantity,
      selectedVariants: i.selectedVariants,
      finalPrice: i.finalPrice,
      product: {
        id: i.product.id,
        name: i.product.name,
        price: String(i.product.price),
        productOwner:
          (i.product as { productOwner?: string; vendorId?: string }).productOwner ||
          (i.product as { vendorId?: string }).vendorId,
      },
    }))

    const cartTotal = cartRef.current.reduce((sum, item) => {
      const price = item.finalPrice || parseFloat(item.product.price)
      return sum + price * item.quantity
    }, 0)

    const shippingCost = billing.shippingMethod === 'pickup' ? 0 : 65
    const total = cartTotal + shippingCost
    const rail = normalizePaymentRail(billing.paymentMethod)

    const orderPayload = {
      items,
      total,
      subtotal: cartTotal,
      shippingInfo: {
        firstName: billing.firstName,
        lastName: billing.lastName,
        email: billing.email,
        phone: billing.phone || shippingFlat.phone,
        address: shippingFlat.address,
        city: shippingFlat.city,
        postalCode: shippingFlat.postalCode,
        country: shippingFlat.country,
        method: billing.shippingMethod,
        location: billing.shippingLocation,
      },
      billingInfo: {
        ...billingFlat,
        firstName: billing.firstName,
        lastName: billing.lastName,
        email: billing.email,
      },
      payment: {
        method: rail,
        status: 'pending' as const,
      },
      status: 'new' as const,
    }

    const fd = new FormData()
    fd.set('payload', JSON.stringify(orderPayload))
    fd.set('paymentMethod', rail)
    if (billing.paymentCurrency) {
      fd.set('paymentCurrency', billing.paymentCurrency)
    }
    fd.set(
      'returnUrl',
      `${window.location.origin}/${locale}/store/checkout/processing?orderId=PENDING`,
    )
    fd.set('locale', locale)
    return placeAndPayStoreOrder(null, fd)
  }

  const [placeState, placeAction] = useActionState(placeOrderAction, null)

  const vendorOwnerRefs = useMemo(() => {
    return cartItems
      .map((i) => {
        const p = i.product as { productOwner?: string; ownerEntityId?: string; vendorId?: string }
        return p.ownerEntityId || p.productOwner || p.vendorId || ''
      })
      .filter(Boolean)
  }, [cartItems])

  useEffect(() => {
    let cancelled = false
    if (vendorOwnerRefs.length === 0) {
      setShowOffer(false)
      return
    }
    void isCheckoutSpecialOfferEnabledForVendors(vendorOwnerRefs)
      .then((enabled) => {
        if (!cancelled) setShowOffer(enabled)
      })
      .catch(() => {
        if (!cancelled) setShowOffer(false)
      })
    return () => {
      cancelled = true
    }
  }, [vendorOwnerRefs])

  useEffect(() => {
    if (!placeState || placeState === handledStateRef.current) return
    handledStateRef.current = placeState

    if (placeState.error) {
      alert(placeState.error)
      return
    }

    if (placeState.orderId) setOrderId(placeState.orderId)

    if (placeState.referralApplied) {
      // Redirect rails leave the page, so stash the flash instead of toasting.
      const rail = normalizePaymentRail(billingData?.paymentMethod)
      if (rail === 'card' || rail === 'paypal') {
        stashReferralCheckoutFlash({ referralCode: placeState.referralCode })
      } else {
        toastSuccess({
          title: t('referralApplied'),
          description: placeState.referralCode
            ? t('referralAppliedToast', { code: placeState.referralCode })
            : t('referralAppliedToastGeneric'),
        })
      }
    }

    if (placeState.doneInline) {
      clearCart()
      router.push(`/${locale}/store/checkout/success`)
      return
    }

    if (placeState.redirect || placeState.paymentUrl || placeState.paymentFields) {
      followCheckoutResult({
        redirect: placeState.redirect,
        paymentUrl: placeState.paymentUrl,
        paymentFields: placeState.paymentFields,
      })
      return
    }

    if (placeState.success && placeState.orderId) {
      setStep('confirmation')
    }
  }, [placeState, billingData, clearCart, locale, router, t, toastSuccess])

  const handleProceedToPayment = async (data: BillingData) => {
    setBillingData(data)
    setStep('review')
  }

  if (step === 'confirmation' && orderId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-4">{t('orderConfirmed')}</h1>
        <div className="mb-6">
          {t('yourOrderId')}: {orderId}
        </div>
        <Link className="underline" href={ROUTES.STORE(locale)}>
          {t('continueShopping')}
        </Link>
      </div>
    )
  }

  const cartTotal = cartItems.reduce(
    (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
    0,
  )

  return (
    <div>
      <SpecialOfferModal
        offer={{
          id: 'checkout-offer-1',
          title: t('specialOfferTitle'),
          description: t('specialOfferDesc'),
          price: undefined,
          currency: currency as 'USD' | 'UAH' | 'EUR' | 'RING',
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          ctaText: t('specialOfferCta'),
          dismissText: t('dismiss'),
          onClick: () => setShowOffer(false),
        }}
        open={showOffer}
        onOpenChange={setShowOffer}
        floating
      />

      {step === 'prebilling' && (
        <PrebillingPage
          cartItems={cartItems}
          cartTotal={{ [currency]: cartTotal } as Record<StorePaymentMethods, number>}
          currency={currency}
          mainCurrency={currency}
          onProceedToPayment={handleProceedToPayment}
          returnTo={`/${locale}/store/checkout`}
        />
      )}

      {step === 'review' && billingData && (
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-semibold mb-6">{t('reviewOrder')}</h1>
          <div className="space-y-6">
            <form action={placeAction}>
              <ReviewStepSubmit />
            </form>
            <div className="flex gap-3">
              <button className="underline" onClick={() => setStep('prebilling')} type="button">
                {t('back')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReviewStepSubmit() {
  const { pending } = useFormStatus()
  return <ReviewStep submitting={pending} asFormSubmit />
}
