import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import { Button } from '@/components/ui/button'
import { defaultLocale } from '@/i18n-config'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold text-primary">404: Not Found</h2>
        <p className="text-xl text-muted-foreground">Could not find requested resource</p>
        <Button asChild>
          <Link href={ROUTES.HOME(defaultLocale)}>
            Return home
          </Link>
        </Button>
      </div>
    </div>
  )
}

/**
 * Note: In Next.js 15, the root app/not-found.tsx file handles all unmatched URLs 
 * for the entire application. This means it will catch both expected notFound() 
 * errors and any URLs not explicitly handled in your app.
 */

/**
 * Version History:
 * - Next.js v13.0.0: not-found introduced
 * - Next.js v13.3.0: Root app/not-found handles global unmatched URLs
 * - Next.js v15.0.0: Default Server Component, can be async for data fetching
 */

