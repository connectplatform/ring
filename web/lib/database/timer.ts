/**
 * Build-safe monotonic timer for database performance measurement.
 *
 * Next.js 16 with cacheComponents intercepts Date.now() during prerendering
 * and rejects pages that access wall-clock time before dynamic data sources.
 * process.hrtime.bigint() provides monotonic nanosecond timing that is NOT
 * intercepted, allowing database initialization and queries to run at build time.
 *
 * This enables static prerendering of public pages (news, categories, store)
 * that use initializeDatabase() without requiring await connection().
 */

/** Monotonic millisecond timestamp - safe during Next.js prerendering */
export function monotime(): number {
  return Number(process.hrtime.bigint() / 1_000_000n)
}
