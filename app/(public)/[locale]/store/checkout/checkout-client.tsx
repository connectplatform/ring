'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { useStore } from '@/features/store/context'
import { PrebillingPage, type BillingData } from '@/features/store/components/checkout/prebilling-page'
import { ReviewStep } from '@/features/store/components/checkout/review-step'
import type { Locale } from '@/i18n-config'
import { useTranslations } from 'next-intl'
import { SpecialOfferModal } from '@/features/store/components/special-offer-modal'

export default function CheckoutClient({ locale }: { locale: Locale }) {
	const router = useRouter()
	const [submitting, setSubmitting] = useState(false)
	const [orderId, setOrderId] = useState<string | null>(null)
	const { cartItems, clearCart } = useStore()
	const [step, setStep] = useState<'prebilling' | 'review' | 'confirmation'>('prebilling')
	const [billingData, setBillingData] = useState<BillingData | null>(null)
  const t = useTranslations('modules.store.checkout')
  const [showOffer, setShowOffer] = useState(true)

	const handleProceedToPayment = async (data: BillingData) => {
		setBillingData(data)
		setStep('review')
	}

	const handlePlaceOrder = async () => {
		if (!billingData) return

		setSubmitting(true)
		try {
			// Create order with billing data (Phase 2: Include variants!)
			const items = cartItems.map(i => ({
				productId: i.product.id,
				name: i.product.name,
				price: i.product.price,
				currency: 'UAH', // Convert to UAH for WayForPay
				quantity: i.quantity,
				// Phase 2: Include selected variants and final price
				selectedVariants: i.selectedVariants,
				finalPrice: i.finalPrice
			}))
			
			// Phase 2: Use finalPrice for total calculation if available
			const cartTotal = cartItems.reduce((sum, item) => {
				const price = item.finalPrice || parseFloat(item.product.price)
				return sum + (price * item.quantity)
			}, 0)
			
			const shippingCost = billingData.shippingMethod === 'pickup' ? 0 : 65
			const total = cartTotal + shippingCost

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

			// Create order
			const orderRes = await fetch('/api/store/orders', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(orderPayload)
			})
			
			if (!orderRes.ok) throw new Error('Order creation failed')
			const orderData = await orderRes.json()
			setOrderId(orderData.orderId)

			// Handle payment based on method
			if (billingData.paymentMethod === 'wayforpay') {
				// Initiate WayForPay payment via API
				const paymentRes = await fetch('/api/store/payments/wayforpay', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						orderId: orderData.orderId,
						returnUrl: `${window.location.origin}/${locale}/store/checkout/processing?orderId=${orderData.orderId}`,
						locale: locale === 'uk' ? 'UK' : 'EN'
					})
				})

				if (!paymentRes.ok) {
					throw new Error('Failed to initiate payment')
				}

				const paymentResult = await paymentRes.json()

				if (paymentResult.success && paymentResult.paymentUrl) {
					// Redirect to WayForPay
					window.location.href = paymentResult.paymentUrl
					return
				} else {
					throw new Error('Failed to initiate payment')
				}
			} else {
				// For other payment methods, go to confirmation
				clearCart()
				setStep('confirmation')
			}
		} catch (e) {
			console.error('Order placement failed:', e)
			alert(t('orderPlacementFailed'))
		} finally {
			setSubmitting(false)
		}
	}

	if (step === 'confirmation' && orderId) {
		return (
			<div>
				<h1 className="text-2xl font-semibold mb-4">{t('orderConfirmed')}</h1>
				<div className="mb-6">{t('yourOrderId')}: {orderId}</div>
				<Link className="underline" href={ROUTES.STORE(locale)}>{t('continueShopping')}</Link>
			</div>
		)
	}

	const cartTotal = cartItems.reduce((sum, item) => 
		sum + (parseFloat(item.product.price) * item.quantity), 0
	)

	return (
		<div>
			{/* Special offer floating modal - demo wiring for Store feature */}
			<SpecialOfferModal
				offer={{
					id: 'checkout-offer-1',
					title: t('specialOfferTitle', { default: 'Limited time: Free Shipping' }) as unknown as string,
					description: t('specialOfferDesc', { default: 'Order today and get free shipping on all items.' }) as unknown as string,
					price: undefined,
					currency: 'UAH',
					expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
					ctaText: t('specialOfferCta', { default: 'Apply Offer' }) as unknown as string,
					dismissText: t('dismiss', { default: 'Dismiss' }) as unknown as string,
					onClick: () => setShowOffer(false)
				}}
				open={showOffer}
				onOpenChange={setShowOffer}
				floating
			/>

			{step === 'prebilling' && (
				<PrebillingPage
					cartItems={cartItems}
					cartTotal={cartTotal}
					onProceedToPayment={handleProceedToPayment}
					returnTo={`/${locale}/store/checkout`}
				/>
			)}

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
