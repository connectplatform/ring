// Locale Tracking Script for Ring Platform
// Tracks locale changes and provides analytics for internationalization

console.log('Ring Platform Locale Tracking: Ready')

// Locale tracking utilities
window.ringLocaleTracking = {
  currentLocale: null,
  defaultLocale: 'en',
  supportedLocales: ['en', 'uk', 'ru'],
  
  // Initialize locale tracking
  init: function() {
    this.currentLocale = this.detectLocale()
    this.trackPageLocale()
    this.bindLocaleEvents()
    console.log('Locale Tracking: Initialized with locale -', this.currentLocale)
  },
  
  // Detect current locale from URL or browser
  detectLocale: function() {
    // Try to get locale from URL pathname
    const urlLocale = window.location.pathname.split('/')[1]
    if (this.supportedLocales.includes(urlLocale)) {
      return urlLocale
    }
    
    // Try to get from localStorage
    const storedLocale = localStorage.getItem('ring-locale')
    if (storedLocale && this.supportedLocales.includes(storedLocale)) {
      return storedLocale
    }
    
    // Try to get from browser language
    const browserLang = navigator.language.split('-')[0]
    if (this.supportedLocales.includes(browserLang)) {
      return browserLang
    }
    
    return this.defaultLocale
  },
  
  // Track locale for current page
  trackPageLocale: function() {
    if (window.ringAnalytics && window.ringAnalytics.track) {
      window.ringAnalytics.track('locale_page_view', {
        locale: this.currentLocale,
        page: window.location.pathname,
        referrer: document.referrer,
        timestamp: new Date().toISOString()
      })
    }
  },
  
  // Track locale change event
  trackLocaleChange: function(fromLocale, toLocale, method = 'unknown') {
    console.log(`Locale Tracking: Changed from ${fromLocale} to ${toLocale} via ${method}`)
    
    if (window.ringAnalytics && window.ringAnalytics.track) {
      window.ringAnalytics.track('locale_change', {
        from_locale: fromLocale,
        to_locale: toLocale,
        method: method,
        page: window.location.pathname,
        timestamp: new Date().toISOString()
      })
    }
    
    // Store new locale
    localStorage.setItem('ring-locale', toLocale)
    this.currentLocale = toLocale
  },
  
  // Bind events for locale changes
  bindLocaleEvents: function() {
    // Track locale selector changes
    document.addEventListener('click', (event) => {
      if (event.target.matches('[data-locale]')) {
        const newLocale = event.target.getAttribute('data-locale')
        if (newLocale !== this.currentLocale) {
          this.trackLocaleChange(this.currentLocale, newLocale, 'selector')
        }
      }
    })
    
    // Track navigation locale changes
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
  
  // Get locale statistics
  getStats: function() {
    return {
      currentLocale: this.currentLocale,
      supportedLocales: this.supportedLocales,
      browserLanguage: navigator.language,
      detectedLocale: this.detectLocale(),
      storedLocale: localStorage.getItem('ring-locale'),
      pageUrl: window.location.href
    }
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.ringLocaleTracking.init()
  })
} else {
  window.ringLocaleTracking.init()
}

// Export for manual usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.ringLocaleTracking
} 