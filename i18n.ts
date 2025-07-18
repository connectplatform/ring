import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Import translations
import enTranslations from './locales/en.json'
import ukTranslations from './locales/uk.json'

const resources = {
  en: {
    translation: enTranslations
  },
  uk: {
    translation: ukTranslations
  }
}

// Only initialize browser-specific features on the client side
const isClient = typeof window !== 'undefined'

// Initialize i18n synchronously
const i18nInstance = i18n.use(initReactI18next)

// Add language detector only on client side
if (isClient) {
  import('i18next-browser-languagedetector').then((LanguageDetector) => {
    i18nInstance.use(LanguageDetector.default)
  })
}

i18nInstance.init({
  fallbackLng: 'en',
  lng: isClient ? undefined : 'en',
  debug: false,
  resources,
  interpolation: {
    escapeValue: false
  },
  react: {
    useSuspense: false
  },
  detection: isClient ? {
    order: ['localStorage', 'navigator', 'htmlTag'],
    caches: ['localStorage']
  } : undefined
})

export default i18n