/**
 * Blog URL helpers — dynamic segment is `[username]` with `@` in the path
 * (e.g. `/uk/blog/@ray/my-post`), matching stored `blogUsername` values.
 */

export function normalizeBlogHandle(username: string): string {
  const raw = username?.trim()
  if (!raw) return ''
  return raw.startsWith('@') ? raw : `@${raw}`
}

/** Pathname for `app/.../blog/[username]` (no locale prefix). */
export function blogIndexPathname(username: string): string {
  const handle = normalizeBlogHandle(username)
  return `/blog/${handle}`
}

/** Pathname for `app/.../blog/[username]/[slug]`. */
export function blogArticlePathname(username: string, slug: string): string {
  return `${blogIndexPathname(username)}/${slug}`
}

/** Locale-prefixed href for use in plain `<Link href>` (as-needed prefix handled by caller). */
export function blogArticleHref(locale: string, username: string, slug: string): string {
  const path = blogArticlePathname(username, slug)
  return `/${locale}${path}`
}

export function blogIndexHref(locale: string, username: string): string {
  const path = blogIndexPathname(username)
  return `/${locale}${path}`
}
