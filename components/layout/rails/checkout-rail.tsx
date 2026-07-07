'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  CreditCard,
  Shield,
  Truck,
  HelpCircle,
  Lock,
  CheckCircle,
  Phone,
  MessageCircle,
  BookOpen,
  Award,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

export interface CheckoutSidebarContentProps {
  locale: Locale
  onNavigate?: () => void
  // Can accept real order data later
}

/**
 * Checkout right-rail content (used for mobile floating sidebar).
 * Desktop right rail is intentionally suppressed (PrebillingPage owns the summary).
 */
export default function CheckoutSidebarContent({ locale, onNavigate }: CheckoutSidebarContentProps) {
  const router = useRouter()
  const t = useTranslations('modules.store.checkout')

  // Mock data (will come from props/cart context later)
  const orderSummary = {
    items: [
      { name: 'Organic Green Tea', quantity: 2, price: 30.00 },
      { name: 'Fresh Basil', quantity: 1, price: 8.50 },
      { name: 'Artisan Honey', quantity: 1, price: 22.00 },
    ],
    subtotal: 60.50,
    shipping: 0,
    tax: 4.84,
    total: 65.34
  }

  const securityFeatures = [
    { id: 'ssl', title: t('sslEncryption', { defaultValue: 'SSL Encryption' }), description: t('sslDescription', { defaultValue: '256-bit SSL encryption protects your data' }), icon: Lock },
    { id: 'pci', title: t('pciCompliant', { defaultValue: 'PCI Compliant' }), description: t('pciDescription', { defaultValue: 'Certified PCI DSS Level 1 security' }), icon: Shield },
    { id: 'token', title: t('tokenization', { defaultValue: 'Tokenization' }), description: t('tokenDescription', { defaultValue: 'Your card details are never stored' }), icon: CreditCard },
    { id: 'monitoring', title: t('fraudMonitoring', { defaultValue: 'Fraud Monitoring' }), description: t('fraudDescription', { defaultValue: '24/7 fraud detection and prevention' }), icon: Award },
  ]

  const deliveryOptions = [
    { id: 'standard', name: t('standardDelivery', { defaultValue: 'Standard Delivery' }), cost: t('free', { defaultValue: 'Free' }), time: '3-5 business days' },
    { id: 'express', name: t('expressDelivery', { defaultValue: 'Express Delivery' }), cost: '$9.99', time: '1-2 business days' },
  ]

  const supportOptions = [
    { id: 'phone', title: t('phoneSupport', { defaultValue: 'Phone Support' }), description: '1-800-RING-HELP', available: '24/7', icon: Phone },
    { id: 'chat', title: t('liveChat', { defaultValue: 'Live Chat' }), description: t('chatDescription', { defaultValue: 'Instant help from our experts' }), available: '24/7', icon: MessageCircle },
    { id: 'faq', title: t('faq', { defaultValue: 'FAQ' }), description: t('faqDescription', { defaultValue: 'Find answers to common questions' }), available: 'Always', icon: HelpCircle },
  ]

  const navigate = (path: string) => {
    router.push(path)
    onNavigate?.()
  }

  return (
    <div className="space-y-6">
      {/* Order Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {t('orderSummary', { defaultValue: 'Order Summary' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {orderSummary.items.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className="flex-1">{item.name} × {item.quantity}</span>
              <span>${item.price.toFixed(2)}</span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between text-sm">
            <span>{t('subtotal', { defaultValue: 'Subtotal' })}</span>
            <span>${orderSummary.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>{t('shipping', { defaultValue: 'Shipping' })}</span>
            <span className="text-green-600">{t('free', { defaultValue: 'Free' })}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>{t('tax', { defaultValue: 'Tax' })}</span>
            <span>${orderSummary.tax.toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-medium">
            <span>{t('total', { defaultValue: 'Total' })}</span>
            <span>${orderSummary.total.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t('paymentSecurity', { defaultValue: 'Payment Security' })}
          </CardTitle>
          <CardDescription>
            {t('securityDescription', { defaultValue: 'Your payment information is fully protected' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {securityFeatures.map((feature) => (
            <div key={feature.id} className="flex items-start gap-3">
              <div className="p-1 bg-green-100 rounded">
                <feature.icon className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{feature.title}</p>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                {t('secureCheckout', { defaultValue: 'Secure Checkout Guaranteed' })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            {t('deliveryOptions', { defaultValue: 'Delivery Options' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {deliveryOptions.map((option) => (
            <div key={option.id} className="p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{option.name}</p>
                  <p className="text-xs text-muted-foreground">{option.time}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{option.cost}</p>
                </div>
              </div>
            </div>
          ))}
          <Button variant="link" className="w-full p-0 h-auto" onClick={() => navigate(`${ROUTES.DOCS(locale)}/shipping`)}>
            {t('shippingPolicy', { defaultValue: 'Shipping Policy' })} →
          </Button>
        </CardContent>
      </Card>

      {/* Help & Support */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            {t('helpSupport', { defaultValue: 'Help & Support' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {supportOptions.map((option) => (
            <div key={option.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer">
              <div className="p-2 bg-primary/10 rounded-lg">
                <option.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{option.title}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
                <p className="text-xs text-primary">{option.available}</p>
              </div>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={() => navigate(ROUTES.CONTACT(locale))}>
            <MessageCircle className="h-4 w-4 mr-2" />
            {t('contactSupport', { defaultValue: 'Contact Support' })}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
