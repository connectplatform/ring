type JsonRecord = Record<string, any>

/**
 * Build next-intl messages object for a locale with modular splitting support.
 *
 * Loading order (later overwrites earlier):
 * 1) Fallback all.json of default locale
 * 2) Fallback legacy flat file of default locale
 * 3) all.json for requested locale (if exists)
 * 4) Legacy flat file for requested locale (if exists)
 * 5) Split files for requested locale (common.json, modules/*.json, pages/*.json, emails/*.json, seo/*.json, config/*.json)
 */
export async function buildMessages(locale: string): Promise<JsonRecord> {
  // Strict split: load only explicit files (no dynamic path expressions)
  const messages: JsonRecord = {}

  // Helper to load for a specific locale using static import paths
  async function loadFor(targetLocale: 'en' | 'uk' | 'ru') {
    const [
      common,
      pages,
      emails,
      seo,
      config,
      about,
      aboutTrinity,
      deploymentCalculator,
      terms,
      filters,
      search,
      comments,
      privacy,
      landing,
      navigation,
      modAuth,
      modEntities,
      modOpp,
      modMessenger,
      modWallet,
      modStore,
      modProfile,
      modAdmin,
      modSettings,
      modMembership
    ] = await Promise.all([
      import(`@/locales/${targetLocale}/common.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/pages.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/emails.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/seo.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/config.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/about.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/about-trinity.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/deployment-calculator.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/terms.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/filters.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/search.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/comments.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/privacy.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/landing.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/navigation.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/modules/auth.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/modules/entities.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/modules/opportunities.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/modules/messenger.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/modules/wallet.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/modules/store.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/modules/profile.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/modules/admin.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/modules/settings.json`).then(m => m.default).catch(() => ({})),
      import(`@/locales/${targetLocale}/modules/membership.json`).then(m => m.default).catch(() => ({}))
    ])

    return {
      common,
      pages,
      emails,
      seo,
      config,
      about,
      'about-trinity': aboutTrinity,
      'deployment-calculator': deploymentCalculator,
      terms,
      filters,
      search,
      comments,
      privacy,
      landing,
      navigation,
      modules: {
        auth: modAuth,
        entities: modEntities,
        opportunities: modOpp,
        messenger: modMessenger,
        wallet: modWallet,
        store: modStore,
        profile: modProfile,
        admin: modAdmin,
        settings: modSettings,
        membership: modMembership
      }
    }
  }

  const loc = locale === 'uk' ? 'uk' : locale === 'ru' ? 'ru' : 'en'
  const loaded = await loadFor(loc)
  return loaded
}


