This implementation does the following for SEO optimization:

1. Uses Next.js 15's `generateMetadata` function to dynamically generate metadata for the page.
2. Implements `MetaTags` component for basic meta tags, Open Graph, and Twitter card metadata.
3. Uses `JsonLd` component to add structured data for better search engine understanding.
4. Provides a canonical URL to avoid duplicate content issues.
5. Uses the entity's logo as the OG image, with a fallback to a default image.
6. Handles the case when an entity is not found, showing a 404 page.


To further improve SEO for your directory pages:

1. Implement proper internal linking within your directory pages.
2. Create a sitemap.xml file to help search engines discover your pages.
3. Optimize the content of each entity page for relevant keywords.
4. Ensure your pages are mobile-friendly and have good Core Web Vitals scores.
5. Implement proper heading structure (H1, H2, etc.) in your `EntityDetails` component.