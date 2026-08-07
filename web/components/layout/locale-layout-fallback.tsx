/**
 * Content-only loading fallback for unified [locale] layout.
 * Does not include nav/sidebar chrome — LocaleAppChrome stays mounted.
 */
export function LocaleLayoutFallback() {
  return (
    <div className="animate-pulse p-6 space-y-4">
      <div className="h-8 bg-muted rounded w-1/4" />
      <div className="h-4 bg-muted rounded w-1/2" />
      <div className="h-64 bg-muted rounded" />
    </div>
  )
}
