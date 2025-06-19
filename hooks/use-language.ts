'use client'

import { useTranslation } from '@/node_modules/react-i18next'
import { useCallback } from 'react'

export function useLanguage() {
  const { t, i18n } = useTranslation()

  const setLanguage = useCallback((lang: 'en' | 'uk') => {
    i18n.changeLanguage(lang)
  }, [i18n])

  return {
    t,
    language: i18n.language as 'en' | 'uk',
    setLanguage
  }
}