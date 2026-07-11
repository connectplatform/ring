'use client'

import React, { useState, useTransition } from 'react'
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
import { flattenShippingAddress } from '@/features/store/lib/flatten-shipping-address'

export default function CheckoutClient({ locale }: { locale: Locale }) {
	const router = useRouter()

	const [orderId, setOrderId] = useState<string | null>(null)
	const { cartItems, clearCart } = useStore()
	const [step, setStep] = useState<'prebilling' | 'review' | 'confirmation'>('prebilling')
	const [billingData, setBillingData] = useState<BillingData | null>(null)
  const t = useTranslations('modules.store.checkout')
  const { success: toastSuccess } = useToast()
  const [showOffer, setShowOffer] = useState(true)
  const [isPending, startTransition] = useTransition()

	const handleProceedToPayment = async (data: BillingData) => {
		setBillingData(data)
		setStep('review')
	}

	const handlePlaceOrder = () => {
		if (!billingData) return

		startTransition(async () => {
		try {
			const shippingFlat = flattenShippingAddress(billingData.shippingAddress)
			const billingFlat = billingData.billingAddressSameAsShipping
				? shippingFlat
				: flattenShippingAddress(billingData.billingAddress)

			const items = cartItems.map(i => ({
				productId: i.product.id,
				name: i.product.name,
				price: String(i.product.price),
				currency: 'UAH' as const,
				quantity: i.quantity,
				selectedVariants: i.selectedVariants,
				finalPrice: i.finalPrice,
				product: {
					id: i.product.id,
					name: i.product.name,
					price: String(i.product.price),
					productOwner: (i.product as { productOwner?: string; vendorId?: string }).productOwner
						|| (i.product as { vendorId?: string }).vendorId,
				},
			}))
			
			const cartTotal = cartItems.reduce((sum, item) => {
				const price = item.finalPrice || parseFloat(item.product.price)
				return sum + (price * item.quantity)
			}, 0)
			
			const shippingCost = billingData.shippingMethod === 'pickup' ? 0 : 65
			const total = cartTotal + shippingCost

			const orderPayload = {
				items,
				total,
				subtotal: cartTotal,
				shippingInfo: {
					firstName: billingData.firstName,
					lastName: billingData.lastName,
					email: billingData.email,
					phone: billingData.phone || shippingFlat.phone,
					address: shippingFlat.address,
					city: shippingFlat.city,
					postalCode: shippingFlat.postalCode,
					country: shippingFlat.country,
					method: billingData.shippingMethod,
					location: billingData.shippingLocation,
				},
				billingInfo: {
					...billingFlat,
					firstName: billingData.firstName,
					lastName: billingData.lastName,
					email: billingData.email,
				},
				payment: { 
					method: billingData.paymentMethod, 
					status: 'pending' as const,
				},
				status: 'new' as const,
			}

			const orderRes = await fetch('/api/store/orders', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(orderPayload)
			})
			
			if (!orderRes.ok) {
				const errBody = await orderRes.json().catch(() => ({}))
				throw new Error(errBody.error || 'Order creation failed')
			}
			const orderData = await orderRes.json()
			setOrderId(orderData.orderId)

			const method =
				(billingData.paymentMethod as string) === 'ring'
					? 'credit'
					: billingData.paymentMethod

			if (orderData.referralApplied) {
				if (method === 'wayforpay') {
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

			if (method === 'wayforpay') {
				const paymentRes = await fetch('/api/store/payments/wayforpay', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						orderId: orderData.orderId,
						returnUrl: `${window.location.origin}/${locale}/store/checkout/processing?orderId=${orderData.orderId}`,
						locale: locale === 'uk' ? 'UK' : 'EN'
					})
				})

				if (!paymentRes.ok) throw new Error('Failed to initiate payment')
				const paymentResult = await paymentRes.json()
				if (paymentResult.success && paymentResult.paymentUrl) {
					window.location.href = paymentResult.paymentUrl
					return
				}
				throw new Error(paymentResult.error || 'Failed to initiate payment')
			}

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
				clearCart()
				router.push(`/${locale}/store/checkout/success`)
				return
			}

			throw new Error(t('paymentMethodNotAvailable', { default: 'This payment method is not available yet.' }))
		} catch (e) {
			console.error('Order placement failed:', e)
			alert(e instanceof Error ? e.message : t('orderPlacementFailed'))
		}
		})
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

			{step === 'review' && billingData && (
				<div className="max-w-4xl mx-auto px-4 py-8">
					<h1 className="text-2xl font-semibold mb-6">{t('reviewOrder')}</h1>
					<div className="space-y-6">
						<ReviewStep 
							onPlaceOrder={handlePlaceOrder} 
							submitting={isPending}
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
