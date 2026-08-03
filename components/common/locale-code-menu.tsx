'use client'

import React, { useCallback, useState, useTransition } from 'react'
import { Check, Globe } from 'lucide-react'
import { useLocale } from 'next-intl'
import { replaceLocalePath, usePathname, useRouter } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { SUPPORTED_LOCALES } from '@/lib/locale-config'
import {
  localeDisplayLabel,
  localeNativeTitle,
  persistRingLocalePreference,
} from '@/lib/locale-pref'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type LocaleCodeMenuProps = {
  /**
   * Visual style for the trigger button.
   * - docs / panel: Globe icon + native language names in the list
   * - rail / footer: two-letter codes (EN / UA / …)
   * - icon: compact Globe trigger (mobile … menu)
   */
  variant?: 'docs' | 'rail' | 'footer' | 'panel' | 'icon'
  className?: string
  triggerClassName?: string
  contentClassName?: string
  align?: 'start' | 'center' | 'end'
  /** Called after a locale is chosen (even if unchanged). */
  onLocaleChange?: (locale: Locale) => void
}

type TriggerVariant = NonNullable<LocaleCodeMenuProps['variant']>

function usesGlobeTrigger(variant: TriggerVariant): boolean {
  return variant === 'docs' || variant === 'panel' || variant === 'icon'
}

function usesNativeLabels(variant: TriggerVariant): boolean {
  return variant === 'docs' || variant === 'panel' || variant === 'icon'
}

const TriggerButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant: TriggerVariant }
>(function LocaleCodeMenuTrigger({ variant = 'docs', className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        variant === 'docs' &&
          'inline-flex h-8 w-8 items-center justify-center rounded-[99px] hover:bg-accent hover:text-accent-foreground',
        variant === 'panel' &&
          'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs font-medium hover:bg-accent hover:text-accent-foreground',
        variant === 'icon' &&
          'flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10',
        variant === 'rail' &&
          'sidebar-rail-link group relative flex size-10 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-xs font-semibold uppercase text-white hover:bg-white/10',
        variant === 'footer' &&
          'flex h-8 w-full shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent text-[10px] font-semibold uppercase text-white hover:bg-white/10',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
})

/**
 * Shared locale picker droplist.
 * Docs / panel / icon: Globe trigger + full native names (no flags).
 * Rail / footer: two-letter codes.
 */
export function LocaleCodeMenu({
  variant = 'docs',
  className,
  triggerClassName,
  contentClassName,
  align = 'end',
  onLocaleChange,
}: LocaleCodeMenuProps) {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const globe = usesGlobeTrigger(variant)
  const nativeLabels = usesNativeLabels(variant)

  const switchLocale = useCallback(
    (newLocale: Locale) => {
      setOpen(false)
      onLocaleChange?.(newLocale)
      if (newLocale === locale) return
      startTransition(() => {
        persistRingLocalePreference(newLocale)
        replaceLocalePath(router, pathname, newLocale)
      })
    },
    [locale, onLocaleChange, pathname, router],
  )

  return (
    <div className={cn('shrink-0', variant === 'panel' && 'flex flex-1', className)}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <TriggerButton
            variant={variant}
            className={triggerClassName}
            aria-label={`Language: ${localeNativeTitle(locale)}`}
            title={localeNativeTitle(locale)}
            disabled={isPending}
          >
            {globe ? (
              <span className={cn('inline-flex items-center gap-1.5', isPending && 'opacity-50')}>
                <Globe
                  className={cn(variant === 'icon' ? 'h-4 w-4 text-primary' : 'h-4 w-4')}
                  aria-hidden
                />
                {variant === 'panel' ? (
                  <span className="truncate font-medium normal-case">
                    {localeNativeTitle(locale)}
                  </span>
                ) : null}
              </span>
            ) : (
              <span className={isPending ? 'opacity-50' : undefined}>
                {localeDisplayLabel(locale)}
              </span>
            )}
          </TriggerButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          className={cn(
            nativeLabels ? 'min-w-[10rem]' : 'min-w-[5.5rem]',
            // Above mobile fullscreen … menu (z-8990) and floating sidebars
            (variant === 'icon' || variant === 'panel') && 'z-[9100]',
            contentClassName,
          )}
        >
          {SUPPORTED_LOCALES.map((loc) => {
            const active = loc === locale
            const label = nativeLabels ? localeNativeTitle(loc) : localeDisplayLabel(loc)
            return (
              <DropdownMenuItem
                key={loc}
                onClick={() => switchLocale(loc)}
                className={cn(
                  'flex items-center justify-between gap-3',
                  !nativeLabels && 'uppercase',
                  active && 'bg-accent',
                )}
              >
                <span className="font-medium">{label}</span>
                {active ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default LocaleCodeMenu
