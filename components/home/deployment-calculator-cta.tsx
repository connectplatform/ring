'use client'

import { Link, toAppHref } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { Calculator } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { getClientNativeTokenSymbol } from '@/lib/ring-config-client'
import { DavinciGlassPanel, davinciCtaPrimary } from '@/lib/ui/davinci'
import { cn } from '@/lib/utils'

/**
 * Home right-rail Deployment Calculator CTA (Davinci glass).
 * Kept out of the left nav — aside width cannot fit this panel.
 */
export function DeploymentCalculatorCta({ locale }: { locale: Locale }) {
  const tNav = useTranslations('navigation')
  const nativeSymbol = getClientNativeTokenSymbol()
  const href = toAppHref(ROUTES.CALCULATOR(locale))

  return (
    <DavinciGlassPanel
      title={tNav('sidebar.calculateYourProject')}
      description={tNav('sidebar.calculateYourProjectDesc', { token: nativeSymbol })}
      icon={<Calculator className="h-3.5 w-3.5" />}
      beamDuration="5s"
    >
      <Link
        href={href}
        className={cn(
          davinciCtaPrimary,
          'flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm',
        )}
      >
        <Calculator className="h-4 w-4 text-[var(--davinci-beam)]" aria-hidden />
        {tNav('sidebar.calculatorCta')}
      </Link>
    </DavinciGlassPanel>
  )
}
