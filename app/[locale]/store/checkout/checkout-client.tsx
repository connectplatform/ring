'use client'

import React, { useState } from 'react'
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
import { StoreCurrency } from '@/features/store/types'
import { getDefaultStoreCurrencySymbol } from '@/lib/payments/payment.config'

// TODO: Consider using useOptimistic from React 19 for optimistic order placement handling.
// TODO: Analyze if cart/step/billingData should use useReducer if complex branching grows.

export default function CheckoutClient({ locale }: { locale: Locale }) {
	const router = useRouter()

  // State for controlling request submission, order, current step, and billing data
	const [submitting, setSubmitting] = useState(false)
	const [orderId, setOrderId] = useState<string | null>(null)
	const { cartItems, clearCart } = useStore()
	const [step, setStep] = useState<'prebilling' | 'review' | 'confirmation'>('prebilling')
	const [billingData, setBillingData] = useState<BillingData | null>(null)
  const t = useTranslations('modules.store.checkout')
  const { success: toastSuccess } = useToast()
  const [showOffer, setShowOffer] = useState(true)

  // Step: after prebilling info, trigger review step
	const handleProceedToPayment = async (data: BillingData) => {
		setBillingData(data)
		setStep('review')
	}

  // Step: main handling for placing the order
	const handlePlaceOrder = async () => {
    // Defensive: don't proceed if billing data is missing
		if (!billingData) return

		setSubmitting(true) // Disable interactions while submitting
		try {
      // Build array of items in cart, with product props, price, selection, etc.
			const items = cartItems.map(i => ({
				productId: i.product.id,
				name: i.product.name,
				price: i.product.price,
				currency: 'UAH',
				quantity: i.quantity,
				selectedVariants: i.selectedVariants,
				finalPrice: i.finalPrice
			}))
			
      // Calculate total from finalPrice if present, fallback to price
			const cartTotal = cartItems.reduce((sum, item) => {
				const price = item.finalPrice || parseFloat(item.product.price)
				return sum + (price * item.quantity)
			}, 0)
			
      // Determine shipping cost, 0 if pickup method is chosen
			const shippingCost = billingData.shippingMethod === 'pickup' ? 0 : 65
			const total = cartTotal + shippingCost

      // Prepare payload for order POST request
			const orderPayload = {
				items,
				total,
				shippingInfo: {
					firstName: billingData.firstName,
					lastName: billingData.lastName,
					email: billingData.email,
					phone: billingData.phone,
					address: billingData.shippingAddress,
					method: billingData.shippingMethod,
					location: billingData.shippingLocation
				},
				billingInfo: billingData.billingAddressSameAsShipping 
					? billingData.shippingAddress 
					: billingData.billingAddress,
				payment: { 
					method: billingData.paymentMethod, 
					status: 'pending' 
				},
				status: 'new'
			}

      // Call API to create order
			const orderRes = await fetch('/api/store/orders', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(orderPayload)
			})
			
      // If order creation fails, trigger error
			if (!orderRes.ok) throw new Error('Order creation failed')
			const orderData = await orderRes.json()
			setOrderId(orderData.orderId)

      // Adjust payment method: 'ring' is aliased as 'credit'
			const method =
				(billingData.paymentMethod as string) === 'ring'
					? 'credit'
					: billingData.paymentMethod

      // Show referral info via toast or stash-on-redirect, if present
			if (orderData.referralApplied) {
				if (method === 'wayforpay') {
					// For redirecting to WayForPay, stash referral for later display
					stashReferralCheckoutFlash({ referralCode: orderData.referralCode })
				} else {
					toastSuccess({
						title: t('referralApplied'),
						description: orderData.referralCode
							? t('referralAppliedToast', { code: orderData.referralCode })
							: t('referralAppliedToastGeneric'),
					})
				}
			}

      // Payment method: WayForPay (external redirect)
			if (method === 'wayforpay') {
				const paymentRes = await fetch('/api/store/payments/wayforpay', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						orderId: orderData.orderId,
            // TODO: This uses window.location, so only runs on client
						returnUrl: `${window.location.origin}/${locale}/store/checkout/processing?orderId=${orderData.orderId}`,
						locale: locale === 'uk' ? 'UK' : 'EN'
					})
				})

				if (!paymentRes.ok) throw new Error('Failed to initiate payment')
				const paymentResult = await paymentRes.json()
				if (paymentResult.success && paymentResult.paymentUrl) {
					// Redirect browser to external payment page
					window.location.href = paymentResult.paymentUrl
					return
				}
				throw new Error('Failed to initiate payment')
			}

      // Payment method: credit (via Ring, pay internal)
			if (method === 'credit') {
				const creditRes = await fetch('/api/store/payments/credit', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ orderId: orderData.orderId }),
				})
				const creditResult = await creditRes.json()
				if (!creditRes.ok || !creditResult.success) {
					throw new Error(creditResult.error || 'Credit payment failed')
				}
				clearCart() // Order placed, clear cart
				router.push(`/${locale}/store/checkout/success`) // Go to success page
				return
			}

      // If payment method is something not handled, show error
			throw new Error(t('paymentMethodNotAvailable', { default: 'This payment method is not available yet.' }))
		} catch (e) {
      // Log error and alert user if placement failed
			console.error('Order placement failed:', e)
			alert(e instanceof Error ? e.message : t('orderPlacementFailed'))
		} finally {
			setSubmitting(false) // Always re-enable submission on exit of try/catch
		}
	}

  // If in 'confirmation' step, show summary and order ID
	if (step === 'confirmation' && orderId) {
		return (
			<div>
				<h1 className="text-2xl font-semibold mb-4">{t('orderConfirmed')}</h1>
				<div className="mb-6">{t('yourOrderId')}: {orderId}</div>
				<Link className="underline" href={ROUTES.STORE(locale)}>{t('continueShopping')}</Link>
			</div>
		)
	}

  // Compute cart total for billing/review display (not including shipping)
	const cartTotal = cartItems.reduce((sum, item) => 
		sum + (parseFloat(item.product.price) * item.quantity), 0
	)

	return (
		<div>
      {/* Modal for special offer, expires in 2h; can be dismissed inline */}
			<SpecialOfferModal
				offer={{
					id: 'checkout-offer-1',
					title: t('specialOfferTitle', { default: 'Limited time: Free Shipping' }) as unknown as string,
					description: t('specialOfferDesc', { default: 'Order today and get free shipping on all items.' }) as unknown as string,
					price: undefined,
					currency: 'UAH',
					expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
					ctaText: t('specialOfferCta', { default: 'Apply Offer' }) as unknown as string,
					dismissText: t('dismiss', { default: 'Dismiss' }) as unknown as string,
					onClick: () => setShowOffer(false)
				}}
				open={showOffer}
				onOpenChange={setShowOffer}
				floating
			/>

      {/* Show prebilling step form if step==='prebilling' */}
			{step === 'prebilling' && (
				<PrebillingPage
					cartItems={cartItems}
					cartTotal={{ [getDefaultStoreCurrencySymbol() as StoreCurrency]: cartTotal }}
					currency={getDefaultStoreCurrencySymbol() as StoreCurrency}
					defaultCurrency={getDefaultStoreCurrencySymbol() as StoreCurrency}
					onProceedToPayment={handleProceedToPayment}
					returnTo={`/${locale}/store/checkout`}
				/>
			)}

      {/* Show review step if applicable, allows final submission and back */}
			{step === 'review' && billingData && (
				<div className="max-w-4xl mx-auto px-4 py-8">
					<h1 className="text-2xl font-semibold mb-6">{t('reviewOrder')}</h1>
					<div className="space-y-6">
						<ReviewStep 
							onPlaceOrder={handlePlaceOrder} 
							submitting={submitting}
						/>
						<div className="flex gap-3">
							<button 
								className="underline" 
								onClick={() => setStep('prebilling')}
							>
								{t('back')}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
