'use client'

// Standard React and Next.js hooks for state, effect, i18n, and auth session
import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'

// UI components and icon imports
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  Settings, 
  MapPin, 
  CreditCard, 
  User, 
  Plus,
  Edit,
  Trash2,
  Check,
  AlertTriangle,
  Loader2,
  Store,
  Bell
} from 'lucide-react'
import { AddressManager } from '@/features/store/components/checkout/address-manager' // unused import, consider removing
import { PaymentStep } from '@/features/store/components/checkout/payment-step' // unused import, consider removing
import { toast } from '@/hooks/use-toast'
import type { Locale } from '@/i18n/shared'

interface StoreSettingsClientProps {
  locale: Locale
  searchParams: Record<string, string | string[] | undefined>
}

export default function StoreSettingsClient({ locale, searchParams }: StoreSettingsClientProps) {
  const t = useTranslations('modules.store') // used for translations (not actively used in this file)
  const tCommon = useTranslations('common')  // used for common translations (not used here)
  const { data: session } = useSession()     // session info (not actively used yet)
  const [activeTab, setActiveTab] = useState('addresses') // tab selection state
  const [isLoading, setIsLoading] = useState(false)       // loading state (mock, not real)

  // Handle incoming search params to select correct tab via query (?tab=)
  useEffect(() => {
    if (searchParams.tab) {
      setActiveTab(searchParams.tab as string)
    }
  }, [searchParams])

  // TODO: Can use the new useOptimistic or useFormStatus for loading state management with native forms in React 19 when async submit available

  // Addresses state -- mock data for demo only, would normally be fetched via API
  const [addresses, setAddresses] = useState([
    {
      id: '1',
      type: 'shipping',
      name: 'John Doe',
      street: '123 Main St',
      city: 'Kyiv',
      postalCode: '01001',
      country: 'Ukraine',
      isDefault: true
    }
  ])

  // Payment methods state -- also mock data, typically comes from API/backend
  const [paymentMethods, setPaymentMethods] = useState([
    {
      id: '1',
      type: 'wayforpay',
      last4: '4242',
      brand: 'Visa',
      isDefault: true
    }
  ])

  // General store preferences state
  const [preferences, setPreferences] = useState({
    defaultShippingMethod: 'nova_post',
    defaultPaymentMethod: 'wayforpay',
    savePaymentMethods: true,
    emailNotifications: true,
    smsNotifications: false
  })

  // Display loading spinner during loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-0 py-0">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading store settings...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <Store className="h-6 w-6 text-white" />
            </div>
            Store Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your addresses, payment methods, and store preferences
          </p>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          {/* Tab for managing addresses */}
          <TabsTrigger value="addresses" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Addresses
          </TabsTrigger>

          {/* Tab for managing payment methods */}
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payment Methods
          </TabsTrigger>

          {/* Tab for managing preferences */}
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Preferences
          </TabsTrigger>

          {/* Tab for notification preferences */}
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* Addresses Tab Content */}
        <TabsContent value="addresses" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                {/* Section title */}
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Shipping Addresses
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage your shipping addresses for faster checkout
                  </p>
                </div>
                {/* Add Address button (functionality missing) */}
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Address
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Render each address with edit + delete actions (no handlers yet) */}
                {addresses.map((address) => (
                  <div key={address.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{address.name}</h4>
                          {address.isDefault && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {address.street}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {address.city}, {address.postalCode}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {address.country}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* TODO: Add edit handler, consider using native form actions in React 19 */}
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        {/* TODO: Add delete handler, consider using useActionState for React 19 */}
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Empty state */}
                {addresses.length === 0 && (
                  <div className="text-center py-8">
                    <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No Addresses Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Add your first shipping address to speed up checkout
                    </p>
                    {/* TODO: Add real address creation logic with form/modal */}
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Address
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Methods Tab Content */}
        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Methods
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage your saved payment methods
                  </p>
                </div>
                {/* Add Payment Method button (currently non-functional) */}
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment Method
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* List payment methods */}
                {paymentMethods.map((method) => (
                  <div key={method.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded flex items-center justify-center">
                          <CreditCard className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{method.brand} •••• {method.last4}</span>
                            {method.isDefault && (
                              <Badge variant="secondary" className="text-xs">Default</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {method.type === 'wayforpay' ? 'WayForPay' : method.type}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* TODO: Add edit handler; for future React 19, consider using native <form action /> */}
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        {/* TODO: Add delete handler, optimistically update UI with useOptimistic */}
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Payment methods empty state */}
                {paymentMethods.length === 0 && (
                  <div className="text-center py-8">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No Payment Methods</h3>
                    <p className="text-muted-foreground mb-4">
                      Add a payment method for faster checkout
                    </p>
                    {/* TODO: Add payment method flow with a native <form /> or modal */}
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Payment Method
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab Content */}
        <TabsContent value="preferences" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Default Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Default Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Default Shipping Method select */}
                <div>
                  <label className="text-sm font-medium">Default Shipping Method</label>
                  <select 
                    className="w-full mt-1 p-2 border rounded-md"
                    value={preferences.defaultShippingMethod}
                    // Simple value update handler for shipping method
                    onChange={(e) => setPreferences({...preferences, defaultShippingMethod: e.target.value})}
                  >
                    <option value="nova_post">Nova Post</option>
                    <option value="ukr_post">Ukr Post</option>
                    <option value="courier">Courier Delivery</option>
                  </select>
                </div>
                
                {/* Default Payment Method select */}
                <div>
                  <label className="text-sm font-medium">Default Payment Method</label>
                  <select 
                    className="w-full mt-1 p-2 border rounded-md"
                    value={preferences.defaultPaymentMethod}
                    onChange={(e) => setPreferences({...preferences, defaultPaymentMethod: e.target.value})}
                  >
                    <option value="wayforpay">WayForPay</option>
                    <option value="crypto">Cryptocurrency</option>
                    <option value="ring">RING Tokens</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Account Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Account Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Save Payment Methods toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Save Payment Methods</p>
                    <p className="text-sm text-muted-foreground">Securely save payment methods for faster checkout</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={preferences.savePaymentMethods}
                    onChange={(e) => setPreferences({...preferences, savePaymentMethods: e.target.checked})}
                    className="h-4 w-4"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications Tab Content */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Choose how you want to be notified about your orders
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email notifications toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive order updates via email</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={preferences.emailNotifications}
                  onChange={(e) => setPreferences({...preferences, emailNotifications: e.target.checked})}
                  className="h-4 w-4"
                />
              </div>
              
              {/* SMS notifications toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">SMS Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive order updates via SMS</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={preferences.smsNotifications}
                  onChange={(e) => setPreferences({...preferences, smsNotifications: e.target.checked})}
                  className="h-4 w-4"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button for persisting all settings */}
      {/* TODO: Use native React 19 <form> and submit for full progressive enhancement, and validation */}
      <div className="flex justify-end pt-6">
        <Button 
          onClick={() => {
            toast({
              title: "Settings saved",
              description: "Your store settings have been updated successfully."
            })
          }}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <Check className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
      </div>
    </div>
  )
}
