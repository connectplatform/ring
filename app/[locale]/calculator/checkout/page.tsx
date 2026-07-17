import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import { PayProjectOrderButtons } from '@/features/crm/orders/order-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function CalculatorCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ orderId?: string }>
}) {
  await connection()
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTES.LOGIN(locale))
  }

  const { orderId } = await searchParams
  if (!orderId) {
    redirect(ROUTES.CALCULATOR(locale))
  }

  const order = await ProjectOrderService.getById(orderId)
  if (!order || order.userId !== session.user.id) {
    redirect(ROUTES.CALCULATOR(locale))
  }

  if (order.paymentStatus === 'paid') {
    redirect(ROUTES.CALCULATOR_SUCCESS(locale, orderId))
  }

  const t = await getTranslations('calculator')

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('order.checkoutTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm">{order.details}</pre>
          <div className="flex justify-between text-lg font-semibold">
            <span>{t('order.depositDue')}</span>
            <span>
              {order.amount} {order.currency}
            </span>
          </div>
          <PayProjectOrderButtons orderId={order.id} />
        </CardContent>
      </Card>
    </div>
  )
}
