/**
 * RFC 8058 one-click List-Unsubscribe POST + ESP allowlist + SSRF guards.
 * Never GET. Never auto-POST off-allowlist. Body-only URLs are copy-only.
 */

import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export const RFC8058_DEFAULT_ALLOW_HOSTS = [
  'list-manage.com',
  'mailchimp.com',
  'sendgrid.net',
  'sendgrid.com',
  'constantcontact.com',
  'ccsend.com',
  'mailgun.org',
  'mailgun.com',
  'klaviyo.com',
  'klaviyomail.com',
  'beehiiv.com',
  'substack.com',
  'convertkit.com',
  'convertkit-mail.com',
  'customer.io',
  'customeriomail.com',
] as const

const FETCH_TIMEOUT_MS = 5_000
const MAX_BODY_BYTES = 64 * 1024
const MAX_REDIRECTS = 1
const RFC8058_BODY = 'List-Unsubscribe=One-Click'

export type UnsubscribeHeaderParse = {
  unsubscribeUrl: string | null
  oneClick: boolean
}

export type Rfc8058PostResult = {
  status: 'ok' | 'error'
  httpStatus: number | null
  error: string | null
  url: string
}

export type LookupAll = (
  hostname: string,
  options: { all: true; verbatim: true }
) => Promise<Array<{ address: string; family: number }>>

export function findHeader(
  headers: Record<string, string> | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
  return key ? headers[key] : undefined
}

export function firstHttpUrlFromListUnsubscribe(value: string): string | null {
  const angle = [...value.matchAll(/<(https?:\/\/[^>]+)>/gi)].map((m) => m[1])
  const bare = [...value.matchAll(/https?:\/\/[^\s,>]+/gi)].map((m) => m[0])
  const candidates = [...angle, ...bare].map((u) => u.replace(/[)>.,;]+$/, ''))
  return (
    candidates.find((u) => /^https:\/\//i.test(u)) ??
    candidates.find((u) => /^http:\/\//i.test(u)) ??
    null
  )
}

function bodyUnsubscribeUrl(body: string): string | null {
  const bodyMatch = body.match(
    /https?:\/\/[^\s<>"']+(?:unsubscribe|opt[_-]?out|email[_-]?preferences)[^\s<>"']*/i
  )
  return bodyMatch?.[0]?.replace(/[)>.,;]+$/, '') ?? null
}

export function hasOneClickPostHeader(postHeader: string | undefined): boolean {
  if (!postHeader) return false
  return /list-unsubscribe\s*=\s*one-click/i.test(postHeader)
}

/**
 * Header HTTPS URL + List-Unsubscribe-Post → oneClick.
 * Body-only URLs never set oneClick.
 */
export function extractUnsubscribeHeaders(
  rawHeaders: Record<string, string> | undefined,
  body: string
): UnsubscribeHeaderParse {
  const headerVal = findHeader(rawHeaders, 'list-unsubscribe')
  const postVal = findHeader(rawHeaders, 'list-unsubscribe-post')
  const fromHeader = headerVal ? firstHttpUrlFromListUnsubscribe(headerVal) : null
  const httpsHeader = fromHeader && /^https:\/\//i.test(fromHeader) ? fromHeader : null
  const oneClick = Boolean(httpsHeader && hasOneClickPostHeader(postVal))
  return {
    unsubscribeUrl: fromHeader ?? bodyUnsubscribeUrl(body),
    oneClick,
  }
}

export function extractUnsubscribeUrl(
  rawHeaders: Record<string, string> | undefined,
  body: string
): string | null {
  return extractUnsubscribeHeaders(rawHeaders, body).unsubscribeUrl
}

export function normalizeAllowHost(host: string): string {
  return host.trim().toLowerCase().replace(/^\.+/, '').replace(/\.+$/, '')
}

export function hostMatchesAllowlist(hostname: string, allowHosts: readonly string[]): boolean {
  const h = normalizeAllowHost(hostname)
  if (!h) return false
  return allowHosts.some((raw) => {
    const suffix = normalizeAllowHost(raw)
    if (!suffix) return false
    return h === suffix || h.endsWith(`.${suffix}`)
  })
}

export function isUnsubscribeUrlAllowlisted(
  rawUrl: string,
  allowHosts: readonly string[] = RFC8058_DEFAULT_ALLOW_HOSTS
): boolean {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:') return false
    return hostMatchesAllowlist(url.hostname, allowHosts)
  } catch {
    return false
  }
}

export function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  )
}

function mappedIpv4(address: string): string | null {
  const match = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  return match?.[1] ?? null
}

export function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase()
  const mapped = mappedIpv4(normalized)
  if (mapped) return isPrivateIpv4(mapped)
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  )
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return isPrivateIpv4(address)
  if (version === 6) return isPrivateIpv6(address)
  return true
}

export async function assertRfc8058Target(
  rawUrl: string,
  options: {
    allowHosts?: readonly string[]
    lookup?: LookupAll
  } = {}
): Promise<URL> {
  const allowHosts = options.allowHosts ?? RFC8058_DEFAULT_ALLOW_HOSTS
  const lookup = options.lookup ?? dnsLookup
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('Invalid unsubscribe URL')
  }
  if (url.protocol !== 'https:') {
    throw new Error('RFC 8058 POST requires HTTPS')
  }
  if (url.username || url.password) {
    throw new Error('Unsubscribe URLs with userinfo are not allowed')
  }
  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Private unsubscribe host is not allowed')
  }
  if (!hostMatchesAllowlist(hostname, allowHosts)) {
    throw new Error('Unsubscribe host is not on the ESP allowlist')
  }
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error('Private unsubscribe address is not allowed')
    return url
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true })
  if (addresses.length === 0 || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new Error('Unsubscribe host resolves to a private address')
  }
  return url
}

async function drainBody(response: Response): Promise<void> {
  if (!response.body) return
  const reader = response.body.getReader()
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BODY_BYTES) {
        await reader.cancel()
        break
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function postRfc8058Unsubscribe(
  rawUrl: string,
  options: {
    allowHosts?: readonly string[]
    lookup?: LookupAll
    fetchImpl?: typeof fetch
  } = {}
): Promise<Rfc8058PostResult> {
  const allowHosts = options.allowHosts ?? RFC8058_DEFAULT_ALLOW_HOSTS
  const fetchImpl = options.fetchImpl ?? fetch
  try {
    let url = await assertRfc8058Target(rawUrl, { allowHosts, lookup: options.lookup })
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      const response = await fetchImpl(url, {
        method: 'POST',
        redirect: 'manual',
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Ring-EmailCRM/1.0',
        },
        body: RFC8058_BODY,
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        await drainBody(response)
        if (!location || redirect === MAX_REDIRECTS) {
          throw new Error('RFC 8058 redirect was not followed')
        }
        url = await assertRfc8058Target(new URL(location, url).toString(), {
          allowHosts,
          lookup: options.lookup,
        })
        continue
      }

      await drainBody(response)
      const httpStatus = response.status
      if (httpStatus >= 200 && httpStatus < 300) {
        return { status: 'ok', httpStatus, error: null, url: url.toString() }
      }
      return {
        status: 'error',
        httpStatus,
        error: `HTTP ${httpStatus}`,
        url: url.toString(),
      }
    }
    throw new Error('RFC 8058 POST exhausted redirects')
  } catch (err) {
    return {
      status: 'error',
      httpStatus: null,
      error: err instanceof Error ? err.message : 'RFC 8058 POST failed',
      url: rawUrl,
    }
  }
}

export function isRfc8058PostComplete(last: {
  method?: string
  status?: string
} | null | undefined): boolean {
  return last?.method === 'rfc8058-post' && last?.status === 'ok'
}
