'use client'

import { NextIntlClientProvider } from 'next-intl'
import { ReactNode } from 'react'

type Props = {
  children: ReactNode
  locale: string
  messages: any
}

export function I18nProvider({ children, locale, messages }: Props) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/Kyiv">
      {children}
    </NextIntlClientProvider>
  )
} 