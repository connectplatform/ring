# SEO Components

This directory contains SEO optimization components and utilities for the Ring application.

## Overview

The SEO implementation provides comprehensive search engine optimization features using Next.js 15's metadata API and structured data.

## Components

### `MetaTags`
- Generates basic meta tags, Open Graph, and Twitter card metadata
- Supports dynamic content based on entity data
- Includes fallback images and descriptions

### `JsonLd`
- Adds structured data (JSON-LD) for better search engine understanding
- Implements schema.org markup for entities
- Enhances rich snippets in search results

### `generateMetadata`
- Next.js 15 function for dynamic metadata generation
- Creates canonical URLs to prevent duplicate content
- Handles entity-specific metadata with fallbacks

## Features

✅ **Dynamic Metadata Generation** - Uses Next.js 15's `generateMetadata` function  
✅ **Open Graph Support** - Optimized social media sharing  
✅ **Twitter Cards** - Enhanced Twitter previews  
✅ **Structured Data** - JSON-LD implementation for rich snippets  
✅ **Canonical URLs** - Prevents duplicate content issues  
✅ **Entity-Specific Images** - Uses entity logos with fallbacks  
✅ **404 Handling** - Proper error page SEO  

## Implementation Details

The SEO system automatically:
- Generates page titles and descriptions from entity data
- Creates Open Graph and Twitter card metadata
- Adds structured data markup for search engines
- Provides canonical URLs for each page
- Uses entity logos as social media images
- Handles missing entities with proper 404 pages

## Future Improvements

To further enhance SEO performance:

1. **Internal Linking** - Implement proper internal linking within entity pages
2. **Sitemap Generation** - Create a `sitemap.xml` file for better crawlability
3. **Keyword Optimization** - Optimize content for relevant search terms
4. **Core Web Vitals** - Ensure mobile-friendly design and performance
5. **Heading Structure** - Implement proper H1, H2 hierarchy in components

## Usage

```typescript
// Example usage in a page component
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const entity = await getEntity(params.id);
  
  return {
    title: `${entity.name} - Ring`,
    description: entity.description,
    openGraph: {
      title: entity.name,
      description: entity.description,
      images: [entity.logo || '/default-og-image.jpg'],
    },
  };
}
```

## Dependencies

- Next.js 15+
- React 18+
- TypeScript

---

*For more information about SEO best practices, refer to the [Next.js Metadata API documentation](https://nextjs.org/docs/app/building-your-application/optimizing/metadata).*