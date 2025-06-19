/**
 * Custom Elements Index - React 19 Compatible
 * 
 * Exports all Ring platform custom elements for easy registration
 * 
 * Usage:
 * import { registerAllCustomElements } from './components/custom-elements'
 * registerAllCustomElements()
 */

// Import all custom elements
export { RingWidget, RingWidgetComponent } from './ring-widget'
export { EntityCard, EntityCardComponent } from './entity-card-element'
export { OpportunityWidget, OpportunityWidgetComponent } from './opportunity-widget'
export { NewsFeed, NewsFeedComponent } from './news-feed-element'
export { SearchWidget, SearchWidgetComponent } from './search-widget'

/**
 * Register all custom elements at once
 * Useful for embedding multiple widgets on external sites
 */
export function registerAllCustomElements() {
  // Import and register all elements
  import('./ring-widget')
  import('./entity-card-element')
  import('./opportunity-widget')
  import('./news-feed-element')
  import('./search-widget')
}

/**
 * Custom element registration status
 */
export function getRegistrationStatus() {
  return {
    'ring-widget': !!customElements.get('ring-widget'),
    'entity-card': !!customElements.get('entity-card'),
    'opportunity-widget': !!customElements.get('opportunity-widget'),
    'news-feed': !!customElements.get('news-feed'),
    'search-widget': !!customElements.get('search-widget')
  }
}

/**
 * Embed script generator for external websites
 */
export function generateEmbedScript(baseUrl: string = 'https://ring.technoring.com') {
  return `
<!-- Ring Platform Custom Elements -->
<script type="module">
  import { registerAllCustomElements } from '${baseUrl}/js/custom-elements.js';
  registerAllCustomElements();
</script>

<!-- Example Usage -->
<!-- <ring-widget theme="light" max-items="5"></ring-widget> -->
<!-- <entity-card entity-id="123" theme="dark"></entity-card> -->
<!-- <opportunity-widget categories="investment" max-items="3"></opportunity-widget> -->
<!-- <news-feed max-items="5" show-images="true"></news-feed> -->
<!-- <search-widget placeholder="Search Ring..." theme="light"></search-widget> -->
  `.trim()
} 