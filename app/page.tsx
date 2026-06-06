import { redirect } from 'next/navigation'
import { defaultLocale } from '@/i18n/shared'

/** Satisfies Next root route; localized home is under `(public)/[locale]`. */
export default function RootPage() {
  redirect(`/${defaultLocale}`)
}
