import 'server-only'

import { DEFAULT_LOCALE, resolveLocale, type Locale } from '@/lib/locale-config'

type StoreProductLabels = {
  agentWelcome?: string
  agentChatFallback?: string
  aiSalesAssistant?: string
}

type StoreModule = {
  product?: StoreProductLabels
}

async function loadStoreModule(locale: Locale): Promise<StoreModule> {
  try {
    return (await import(`@/locales/${locale}/modules/store.json`)).default as StoreModule
  } catch {
    if (locale !== DEFAULT_LOCALE) {
      return loadStoreModule(DEFAULT_LOCALE)
    }
    return {}
  }
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
    template,
  )
}

export async function getProductAgentWelcome(locale: string, productName: string): Promise<string> {
  const loc = resolveLocale(locale)
  const mod = await loadStoreModule(loc)
  const template =
    mod.product?.agentWelcome ??
    'Hi! I can help with questions about {name}. Ask about features, sizing, shipping, or how to order.'

  return interpolate(template, { name: productName })
}

export async function getProductAgentFallbackReply(locale: string): Promise<string> {
  const loc = resolveLocale(locale)
  const mod = await loadStoreModule(loc)
  return (
    mod.product?.agentChatFallback ??
    'I am here to help with this product. Could you rephrase your question?'
  )
}

export async function getProductAgentSenderName(locale: string): Promise<string> {
  const loc = resolveLocale(locale)
  const mod = await loadStoreModule(loc)
  return mod.product?.aiSalesAssistant ?? 'AI Sales Assistant'
}
