// Analytics placeholder script
// This file prevents 404 errors during development

console.log('Ring Platform Analytics: Ready')

// Basic page view tracking placeholder
window.ringAnalytics = {
  pageView: function(page) {
    console.log('Analytics: Page view -', page)
  },
  
  track: function(event, data) {
    console.log('Analytics: Event -', event, data)
  }
}

// Auto-track page view
if (typeof window !== 'undefined') {
  window.ringAnalytics.pageView(window.location.pathname)
} 