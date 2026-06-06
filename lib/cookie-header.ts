import { cookies, headers } from 'next/headers'

/**
 * Builds a `Cookie` request header for forwarding the browser session to an internal `fetch`.
 *
 * **Next.js 16:** `await cookies()` / `await headers()` (async dynamic APIs — `nextjs-16-specialist`).
 *
 * **Ring tunnel / session fidelity (`ring-tunnel-transport-specialist`):** prefer the **wire**
 * `Cookie` header from `headers()` so bytes match what the client sent (no re-encoding drift
 * across transports / internal API hops).
 *
 * **RFC 6265 (`Cookie` header, Section 4.2):** `cookie-string = cookie-pair *( ";" SP cookie-pair )`,
 * `cookie-name = token`, `cookie-value = *cookie-octet / ( DQUOTE *cookie-octet DQUOTE )`.
 * When the wire header is absent, we serialize from `cookies().getAll()` with quoting/escapes
 * when values are not `cookie-octet` unquoted.
 */
export async function getRequestCookieHeader(): Promise<string> {
  const headersList = await headers()
  const raw = headersList.get('cookie')
  if (raw != null && raw.trim().length > 0) {
    return raw.trim()
  }

  const cookieStore = await cookies()
  return serializeCookieHeaderRfc6265(cookieStore.getAll())
}

/** `token` (RFC 7230 tchar-style) — cookie-name must be a token. */
const COOKIE_NAME_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

/**
 * Serialize `cookie-pair` list to a `Cookie` header value (no `Cookie:` prefix).
 * Skips pairs with invalid `cookie-name` (defensive).
 */
export function serializeCookieHeaderRfc6265(
  pairs: ReadonlyArray<{ name: string; value: string }>,
): string {
  const out: string[] = []
  for (const { name, value } of pairs) {
    if (!name || !COOKIE_NAME_TOKEN.test(name)) continue
    out.push(`${name}=${serializeCookieValueRfc6265(value)}`)
  }
  return out.join('; ')
}

function serializeCookieValueRfc6265(value: string): string {
  if (value === '') return ''

  if (isCookieOctetStringUnquoted(value)) {
    return value
  }

  return `"${escapeCookieValueForDoubleQuotedForm(value)}"`
}

/** `cookie-octet` allowed without quotes (RFC 6265). */
function isCookieOctetStringUnquoted(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i)
    if (c === 0x22 || c === 0x2c || c === 0x3b || c === 0x5c) return false
    if (c < 0x21 || c > 0x7e) return false
    if (c === 0x20 || c === 0x09) return false
  }
  return true
}

/**
 * Inside `DQUOTE ... DQUOTE`, escape `\` and `"` for safe re-parsing by typical stacks.
 * (Strict RFC parsing of quoted cookie-value varies; opaque `headers().get('cookie')` remains best.)
 */
function escapeCookieValueForDoubleQuotedForm(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
