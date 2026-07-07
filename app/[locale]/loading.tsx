// Importing a fallback UI component to display during locale-specific loading.
// This pattern separates loading concerns by delegating to a presentational component.
import { LocaleLayoutFallback } from '@/components/layout/locale-layout-fallback'

// The Loading component is used by Next.js (app directory) as a route-level loading state.
// It simply returns the locale fallback UI while the actual locale-specific content is loaded.
export default function Loading() {
  // TODO: In React 19 with Next.js 16, consider using the new <Loading /> conventions or integrating React's useTransition for granular suspense boundaries if loading states become more complex.
  return <LocaleLayoutFallback />
}
