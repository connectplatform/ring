import { redirect } from 'next/navigation'
import { defaultLocale } from '@/i18n-config'

// Root page redirects to the default locale
export default function RootPage() {
  redirect(`/${defaultLocale}`)
}
