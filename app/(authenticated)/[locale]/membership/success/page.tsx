import { Suspense } from 'react'
import { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { Locale } from '@/i18n-config'
import { ROUTES } from '@/constants/routes'
import { connection } from 'next/server'

export const metadata: Metadata = {
  title: 'Payment Successful - Ring Platform',
  description: 'Your membership upgrade was successful',
  robots: 'noindex, nofollow'
}

interface MembershipSuccessPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ orderId?: string }>
}

export default async function MembershipSuccessPage({
  params,
  searchParams
}: MembershipSuccessPageProps) {
  await connection() // Next.js 16: opt out of prerendering

  const session = await auth()
  if (!session?.user) {
    const { locale: loc } = await params
    redirect(ROUTES.LOGIN(loc as any))
  }

  const { locale } = await params
  const { orderId } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            Your membership has been upgraded successfully
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium text-green-600 dark:text-green-400">Completed</span>
            </div>
            {orderId && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order ID</span>
                <span className="font-mono text-xs">{orderId}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">New Role</span>
              <span className="font-medium capitalize">{session.user.role}</span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              Welcome to your enhanced Ring Platform experience! Your new membership benefits are now active.
            </p>
            
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href={`/${locale}/profile`}>
                  View Your Profile
                </Link>
              </Button>
              
              <Button asChild variant="outline" className="w-full">
                <Link href={`/${locale}`}>
                  Return to Home
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

