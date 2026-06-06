// Locale Tracking Script for Ring Platform
// Reads window.__RING_LOCALE_CONFIG__ (set in app/layout.tsx from lib/locale-config)

console.log('Ring Platform Locale Tracking: Ready')

const runtimeCfg = window.__RING_LOCALE_CONFIG__ || {
  defaultLocale: 'en',
  supportedLocales: ['en', 'uk', 'ru'],
}

window.ringLocaleTracking = {
  currentLocale: null,
  defaultLocale: runtimeCfg.defaultLocale,
  supportedLocales: [...runtimeCfg.supportedLocales],

  init: function () {
    this.currentLocale = this.detectLocale()
    this.trackPageLocale()
    this.bindLocaleEvents()
    console.log('Locale Tracking: Initialized with locale -', this.currentLocale)
  },

  detectLocale: function () {
    const urlLocale = window.location.pathname.split('/')[1]
    if (this.supportedLocales.includes(urlLocale)) {
      return urlLocale
    }

    const storedLocale = localStorage.getItem('ring-locale')
    if (storedLocale && this.supportedLocales.includes(storedLocale)) {
      return storedLocale
    }

    const browserLang = navigator.language.split('-')[0]
    if (this.supportedLocales.includes(browserLang)) {
      return browserLang
    }

    return this.defaultLocale
  },

  trackPageLocale: function () {
    if (window.ringAnalytics && window.ringAnalytics.track) {
      window.ringAnalytics.track('locale_page_view', {
        locale: this.currentLocale,
        page: window.location.pathname,
        referrer: document.referrer,
        timestamp: new Date().toISOString(),
      })
    }
  },

  trackLocaleChange: function (fromLocale, toLocale, method = 'unknown') {
    console.log(`Locale Tracking: Changed from ${fromLocale} to ${toLocale} via ${method}`)

    if (window.ringAnalytics && window.ringAnalytics.track) {
      window.ringAnalytics.track('locale_change', {
        from_locale: fromLocale,
        to_locale: toLocale,
        method: method,
        page: window.location.pathname,
        timestamp: new Date().toISOString(),
      })
    }

    localStorage.setItem('ring-locale', toLocale)
    this.currentLocale = toLocale
  },

  bindLocaleEvents: function () {
    document.addEventListener('click', (event) => {
      if (event.target.matches('[data-locale]')) {
        const newLocale = event.target.getAttribute('data-locale')
        if (newLocale !== this.currentLocale) {
          this.trackLocaleChange(this.currentLocale, newLocale, 'selector')
        }
      }
    })

    let lastPathname = window.location.pathname
    const observer = new MutationObserver(() => {
      if (window.location.pathname !== lastPathname) {
        const newLocale = this.detectLocale()
        if (newLocale !== this.currentLocale) {
          this.trackLocaleChange(this.currentLocale, newLocale, 'navigation')
        }
        lastPathname = window.location.pathname
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
  },

  getStats: function () {
    return {
      currentLocale: this.currentLocale,
      supportedLocales: this.supportedLocales,
      browserLanguage: navigator.language,
      detectedLocale: this.detectLocale(),
      storedLocale: localStorage.getItem('ring-locale'),
      pageUrl: window.location.href,
    }
  },
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.ringLocaleTracking.init()
  })
} else {
  window.ringLocaleTracking.init()
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.ringLocaleTracking
}
