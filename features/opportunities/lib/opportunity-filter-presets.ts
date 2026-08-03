/**
 * Opportunity filter SSOT — Ring Platform categories (i18n: modules.opportunities.*).
 * Not in ring-config.json; aligned with seed data and ring-platform.org locales.
 */

export const OPPORTUNITY_FILTER_TYPE_IDS = [
  'request',
  'offer',
  'cv',
  'ring_customization',
] as const

export type OpportunityFilterTypeId = (typeof OPPORTUNITY_FILTER_TYPE_IDS)[number]

/** Platform + Ring customization categories used in browse filters and forms. */
export const OPPORTUNITY_FILTER_CATEGORY_IDS = [
  'technology',
  'business',
  'education',
  'healthcare',
  'finance',
  'platform_deployment',
  'module_development',
  'branding_customization',
  'database_migration',
  'localization',
  'payment_integration',
  'smart_contracts',
  'ai_customization',
  'token_economics',
  'documentation_training',
  'other',
] as const

export type OpportunityFilterCategoryId = (typeof OPPORTUNITY_FILTER_CATEGORY_IDS)[number]

export const OPPORTUNITY_FILTER_CURRENCIES = ['USD', 'EUR', 'UAH', 'GBP'] as const

/**
 * Presentment currencies for opportunity budget filters.
 * Main currency is always first; remaining codes follow without duplicating main.
 */
export function getOpportunityFilterCurrencies(mainCurrency: string): string[] {
  const main = String(mainCurrency || 'USD').toUpperCase()
  const rest = OPPORTUNITY_FILTER_CURRENCIES.filter((c) => c !== main)
  return [main, ...rest]
}
