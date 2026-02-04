import { Suspense } from 'react'
import { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { Locale } from '@/i18n-config'

export const metadata: Metadata = {
  title: 'Payment Failed - Ring Platform',
  description: 'Your membership upgrade payment failed',
  robots: 'noindex, nofollow'
}

interface MembershipFailurePageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ orderId?: string; reason?: string }>
}

export default async function MembershipFailurePage({
  params,
  searchParams
}: MembershipFailurePageProps) {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/signin')
  }

  const { locale } = await params
  const { orderId, reason } = await searchParams

  // Decode reason if present
  const decodedReason = reason ? decodeURIComponent(reason) : 'Payment was declined'

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl">Payment Failed</CardTitle>
          <CardDescription>
            Your membership upgrade was not completed
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium text-red-600 dark:text-red-400">Failed</span>
            </div>
            {orderId && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order ID</span>
                <span className="font-mono text-xs">{orderId}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Reason</span>
              <span className="text-xs">{decodedReason}</span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              {reason?.includes('insufficient') 
                ? 'Your payment was declined due to insufficient funds. Please check your card balance and try again.'
                : reason?.includes('expired')
                ? 'Your payment method has expired. Please use a different card.'
                : 'Your payment could not be processed. Please try again or use a different payment method.'}
            </p>
            
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href={`/${locale}/profile`}>
                  Try Again
                </Link>
              </Button>
              
              <Button asChild variant="outline" className="w-full">
                <Link href={`/${locale}`}>
                  Return to Home
                </Link>
              </Button>
              
              <Button asChild variant="ghost" className="w-full">
                <Link href={`/${locale}/contact`}>
                  Contact Support
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

