'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { MapPin, Settings, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AddressManager } from '@/features/store/components/checkout/address-manager'
import { ROUTES } from '@/constants/routes'
import { toast } from '@/hooks/use-toast'
import { getSupportedCurrencies } from '@/lib/ring-config-core'
import type { SupportedCurrencies } from '@/lib/ring-config-types'
import type { Locale } from '@/i18n/shared'
import type { UserAddress } from '@/features/store/services/address-service'
import type { StoreUserPreferences } from '@/features/store/services/user-preferences-service'
import {
  getUserStorePreferences,
  updateLastUsedAddress,
  updateStorePreferences,
} from '@/app/_actions/store-preferences-actions'

interface StoreSettingsClientProps {
  locale: Locale
  searchParams: Record<string, string | string[] | undefined>
}

const PAYMENT_RAILS = ['card', 'paypal', 'credit_balance', 'native_token'] as const

export default function StoreSettingsClient({ locale, searchParams }: StoreSettingsClientProps) {
  const t = useTranslations('modules.store')
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState('addresses')
  const [prefs, setPrefs] = useState<StoreUserPreferences | null>(null)
  const [saving, setSaving] = useState(false)
  const currencies = getSupportedCurrencies()

  useEffect(() => {
    const tab = searchParams.tab
    if (typeof tab === 'string') setActiveTab(tab)
  }, [searchParams])

  useEffect(() => {
    if (!session?.user?.id) return
    void getUserStorePreferences().then(setPrefs)
  }, [session?.user?.id])

  const savePreferences = async () => {
    if (!prefs) return
    setSaving(true)
    const result = await updateStorePreferences({
      preferredShippingMethod: prefs.preferredShippingMethod,
      preferredPaymentMethod: prefs.preferredPaymentMethod,
      preferredDisplayCurrency: prefs.preferredDisplayCurrency,
      savePaymentMethods: prefs.savePaymentMethods,
    })
    setSaving(false)
    toast({
      title: result.success ? t('settingsSaved', { defaultValue: 'Settings saved' }) : t('settingsSaveFailed', { defaultValue: 'Could not save' }),
    })
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <Store className="h-7 w-7" />
          {t('settingsTitle', { defaultValue: 'Store settings' })}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t('settingsHint', { defaultValue: 'Addresses and checkout preferences for your account.' })}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="addresses" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {t('addresses', { defaultValue: 'Addresses' })}
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t('preferences', { defaultValue: 'Preferences' })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="addresses">
          <Card>
            <CardHeader>
              <CardTitle>{t('shippingAddresses', { defaultValue: 'Shipping addresses' })}</CardTitle>
            </CardHeader>
            <CardContent>
              {session?.user?.id ? (
                <AddressManager
                  userId={session.user.id}
                  selectedAddressId={prefs?.lastUsedAddressId}
                  onAddressSelect={(address: UserAddress) => {
                    if (!address.id) return
                    setPrefs((current) => (current ? { ...current, lastUsedAddressId: address.id } : current))
                    void updateLastUsedAddress(address.id)
                  }}
                />
              ) : (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>{t('signInForAddresses', { defaultValue: 'Sign in to manage shipping addresses.' })}</p>
                  <Button asChild>
                    <Link href={ROUTES.LOGIN(locale)}>{t('signIn', { defaultValue: 'Sign in' })}</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>{t('checkoutPreferences', { defaultValue: 'Checkout preferences' })}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span>{t('defaultShipping', { defaultValue: 'Default shipping' })}</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3"
                  value={prefs?.preferredShippingMethod || 'nova-post'}
                  onChange={(event) =>
                    setPrefs((current) => ({
                      ...(current || { userId: session?.user?.id || '' }),
                      preferredShippingMethod: event.target.value === 'pickup' ? 'pickup' : 'nova-post',
                    }))
                  }
                >
                  <option value="nova-post">Nova Post</option>
                  <option value="pickup">{t('storePickup', { defaultValue: 'Store pickup' })}</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span>{t('defaultPayment', { defaultValue: 'Default payment' })}</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3"
                  value={prefs?.preferredPaymentMethod || 'card'}
                  onChange={(event) =>
                    setPrefs((current) => ({
                      ...(current || { userId: session?.user?.id || '' }),
                      preferredPaymentMethod: PAYMENT_RAILS.includes(event.target.value as (typeof PAYMENT_RAILS)[number])
                        ? (event.target.value as (typeof PAYMENT_RAILS)[number])
                        : 'card',
                    }))
                  }
                >
                  {PAYMENT_RAILS.map((rail) => (
                    <option key={rail} value={rail}>{rail}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span>{t('displayCurrency', { defaultValue: 'Display currency' })}</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3"
                  value={prefs?.preferredDisplayCurrency || currencies[0]}
                  onChange={(event) =>
                    setPrefs((current) => ({
                      ...(current || { userId: session?.user?.id || '' }),
                      preferredDisplayCurrency: event.target.value as SupportedCurrencies,
                    }))
                  }
                >
                  {currencies.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={Boolean(prefs?.savePaymentMethods)}
                  onChange={(event) =>
                    setPrefs((current) => ({
                      ...(current || { userId: session?.user?.id || '' }),
                      savePaymentMethods: event.target.checked,
                    }))
                  }
                />
                {t('savePaymentMethods', { defaultValue: 'Remember payment method' })}
              </label>
              <div className="sm:col-span-2">
                <Button type="button" onClick={savePreferences} disabled={saving || !session?.user}>
                  {saving ? t('saving', { defaultValue: 'Saving…' }) : t('save', { defaultValue: 'Save' })}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
