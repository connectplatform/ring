/**
 * Normalize a username for DB storage — blog articles store `blogUsername`
 * with `@` prefix to distinguish user handles from plain slugs.
 */
export function normalizeBlogHandle(username: string): string {
  const raw = username?.trim()
  if (!raw) return ''
  return raw.startsWith('@') ? raw : `@${raw}`
}

// ── Consolidated user-space route helpers (GitHub-style) ───────────
// Canonical routes: /[username] (profile) and /[username]/[slug] (blog article)
// Static routes (store, about, blog, news, etc.) take priority over [username] dynamic segment.
// Blog articles stored with blogUsername="@handle" in DB for disambiguation.

/** Pathname for `/[username]` (public user profile, no locale prefix). */
export function profileIndexPathname(username: string): string {
  return `/${encodeURIComponent(username)}`
}

/** Pathname for `/[username]/[slug]` (blog article, no locale prefix). */
export function profileArticlePathname(username: string, slug: string): string {
  return `/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`
}

/** Locale-prefixed href for `/[username]`. */
export function profileIndexHref(locale: string, username: string): string {
  const path = profileIndexPathname(username)
  return `/${locale}${path}`
}

/** Locale-prefixed href for `/[username]/[slug]`. */
export function profileArticleHref(locale: string, username: string, slug: string): string {
  const path = profileArticlePathname(username, slug)
  return `/${locale}${path}`
}
