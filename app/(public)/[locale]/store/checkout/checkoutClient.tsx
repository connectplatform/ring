'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import { useStore } from '@/features/store/context'
import { ContactStep } from '@/features/store/components/checkout/contact-step'
import { ShippingStep } from '@/features/store/components/checkout/shipping-step'
import { PaymentStep } from '@/features/store/components/checkout/payment-step'
import { ReviewStep } from '@/features/store/components/checkout/review-step'
import type { NovaPostLocation } from '@/features/store/components/shipping/nova-post-selector'
import type { Locale } from '@/i18n-config'
import { useTranslations } from 'next-intl'

export default function CheckoutClient({ locale }: { locale: Locale }) {
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [email, setEmail] = useState('')
	const [notes, setNotes] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [orderId, setOrderId] = useState<string | null>(null)
	const { cartItems, clearCart } = useStore()
	const [step, setStep] = useState<'contact' | 'shipping' | 'payment' | 'review' | 'confirmation'>('contact')
	const [location, setLocation] = useState<NovaPostLocation | null>(null)
	const [method, setMethod] = useState<'stripe' | 'crypto'>('stripe')
  const t = useTranslations('modules.store.checkout')

	const onPlaceOrder = async () => {
		setSubmitting(true)
		try {
			const items = cartItems.map(i => ({
				productId: i.product.id,
				name: i.product.name,
				price: i.product.price,
				currency: i.product.currency,
				quantity: i.quantity
			}))
			const totals = items.reduce((acc: Record<'DAAR'|'DAARION', number>, it) => {
				const v = parseFloat(it.price) * it.quantity
				acc[it.currency] = (acc[it.currency] || 0) + v
				return acc
			}, { DAAR: 0, DAARION: 0 })
			const payload = {
				items,
				totals,
				checkoutInfo: { firstName, lastName, email, notes },
				shipping: location ? { provider: 'nova-post', location } : undefined,
				payment: { method, status: 'pending' },
				status: 'new'
			}
			const res = await fetch('/api/store/orders', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			})
			if (!res.ok) throw new Error('Order creation failed')
			const data = await res.json()
			setOrderId(data.orderId)
			clearCart()
			setStep('confirmation')
		} catch (e) {
			console.error(e)
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

	return (
		<div>
			<h1 className="text-2xl font-semibold mb-6">{t('title')}</h1>
			<div className="space-y-6 max-w-xl">
				{step === 'contact' && (
					<>
						<ContactStep
							firstName={firstName} lastName={lastName} email={email} notes={notes}
							setFirstName={setFirstName} setLastName={setLastName} setEmail={setEmail} setNotes={setNotes}
						/>
						<div className="flex gap-3">
							<Link className="underline" href={ROUTES.CART(locale)}>{t('backToCart')}</Link>
							<button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={() => setStep('shipping')}>{t('continue')}</button>
						</div>
					</>
				)}

				{step === 'shipping' && (
					<>
						<ShippingStep location={location} setLocation={setLocation} />
						<div className="flex gap-3">
							<button className="underline" onClick={() => setStep('contact')}>{t('back')}</button>
							<button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={() => setStep('payment')} disabled={!location}>{t('continue')}</button>
						</div>
					</>
				)}

				{step === 'payment' && (
					<>
						<PaymentStep method={method} setMethod={setMethod} />
						<div className="flex gap-3">
							<button className="underline" onClick={() => setStep('shipping')}>{t('back')}</button>
							<button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={() => setStep('review')}>{t('review')}</button>
						</div>
					</>
				)}

				{step === 'review' && (
					<>
						<ReviewStep onPlaceOrder={onPlaceOrder} submitting={submitting} />
						<div className="flex gap-3">
							<button className="underline" onClick={() => setStep('payment')}>{t('back')}</button>
						</div>
					</>
				)}
			</div>
		</div>
	)
}
