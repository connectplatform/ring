/**
 * Nova Post v.1.0 branch locator.
 *
 * Portal keys are not API 2.0 keys. Flow:
 * GET https://api.novapost.com/v.1.0/clients/authorization?apiKey=
 * then Authorization: {jwt} on /settlements and /divisions.
 * The key and JWT never leave the server. JWT is cached for 50 minutes.
 *
 * Pod DNS on k8s-1 often returns EAI_AGAIN for this host (ndots search list
 * plus a flaky cluster resolver). Requests retry, prefer IPv4, and fall back
 * to a public resolver so checkout search still reaches the API.
 */

import dns from 'node:dns'
import https from 'node:https'

import { readDivisionSettlement } from '@/features/store/services/fulfillment-ledger'
import { logger } from '@/lib/logger'

export const NOVA_POST_API_BASE = 'https://api.novapost.com/v.1.0'

const NOVA_POST_HOST = 'api.novapost.com'
const CITY_LIMIT = 100
const CITY_RESULT_LIMIT = 15
const DIVISION_PAGE_LIMIT = 100
const DIVISION_PAGE_CAP = 8
const DIVISION_RESULT_LIMIT = 40
const DIVISION_CACHE_MS = 10 * 60 * 1000
const REQUEST_ATTEMPTS = 3

export type NovaPostCity = {
  ref: string
  name: string
  area: string
}

export type NovaPostWarehouse = {
  ref: string
  name: string
  number: string
  address: string
}

type JwtCache = { jwt: string; exp: number }
let jwtCache: JwtCache | null = null

type DivisionCacheEntry = { exp: number; items: unknown[] }
const divisionCache = new Map<string, DivisionCacheEntry>()

export function isNovaPostEnabled(): boolean {
  return Boolean(process.env.NOVAPOST_API_KEY?.trim())
}

/** Create/print/track shipments. Locator search stays on NOVAPOST_API_KEY alone. */
export function isNovaPostShipmentsEnabled(): boolean {
  const flag = process.env.NOVAPOST_SHIPMENTS_ENABLED?.trim().toLowerCase()
  return flag === 'true' || flag === '1'
}

export function novaPostApiKey(): string | null {
  const key = process.env.NOVAPOST_API_KEY?.trim()
  return key || null
}

/** City query. Empty or shorter than 2 chars is not sent upstream. */
export function normalizeNovaPostQuery(raw: string | null | undefined): string | null {
  const q = (raw ?? '').trim().slice(0, 64)
  if (q.length < 2) return null
  return q
}

/** Branch query. A single digit is a real branch number ("3" → №3, then №31). */
export function normalizeNovaPostBranchQuery(raw: string | null | undefined): string | null {
  const q = (raw ?? '').trim().slice(0, 64)
  if (!q) return null
  return q
}

type NpRow = Record<string, unknown>

function str(row: NpRow, key: string): string {
  const value = row[key]
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function regionName(row: NpRow): string {
  const region = row.region
  if (!region || typeof region !== 'object') return ''
  const regionRow = region as NpRow
  const parent = regionRow.parent
  if (parent && typeof parent === 'object') {
    const parentName = str(parent as NpRow, 'name')
    if (parentName) return parentName
  }
  return str(regionRow, 'name')
}

const SETTLEMENT_KIND = /^(селище міського типу|місто|селище|село|смт)\s+/iu

/** "місто Черкаси" → "Черкаси". The oblast stays in `area`. */
export function novaPostSettlementLabel(name: string): string {
  return name.replace(SETTLEMENT_KIND, '').trim()
}

function cityScore(name: string, boost: number, query: string): number {
  const label = novaPostSettlementLabel(name).toLowerCase()
  const q = query.trim().toLowerCase()
  let score = 100_000
  if (label === q) score = 1_000_000
  else if (q && label.startsWith(q)) score = 800_000
  else if (q && label.includes(q)) score = 500_000
  if (name.toLowerCase().startsWith('місто')) score += 50_000
  score += Math.max(0, Math.min(boost, 20_000))
  score -= label.length
  return score
}

export function mapNovaPostCities(rows: unknown, query = ''): NovaPostCity[] {
  if (!Array.isArray(rows)) return []
  const ranked: Array<{ city: NovaPostCity; score: number }> = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const item = row as NpRow
    const ref = str(item, 'id') || str(item, 'Ref')
    const rawName = str(item, 'name') || str(item, 'Description')
    if (!ref || !rawName) continue
    const boostRaw = item.boost
    const boost = typeof boostRaw === 'number' && Number.isFinite(boostRaw) ? boostRaw : 0
    ranked.push({
      city: {
        ref,
        name: novaPostSettlementLabel(rawName) || rawName,
        area: regionName(item) || str(item, 'AreaDescription'),
      },
      score: cityScore(rawName, boost, query),
    })
  }
  if (query.trim()) ranked.sort((a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name, 'uk'))
  return ranked.slice(0, CITY_RESULT_LIMIT).map((entry) => entry.city)
}

/** "Відділення №11 (до 30 кг…): вул. Небесної Сотні, 2" → title without the street. */
export function novaPostDivisionTitle(name: string): string {
  const splitAt = name.search(/:\s+/)
  if (splitAt === -1) return name.trim()
  const title = name.slice(0, splitAt).trim()
  if (/№\s*\d+/u.test(title)) return title
  return name.trim()
}

/**
 * fullAddress is the locator's structured line. Fall back to the postal string
 * with zip, country, and oblast removed: "місто Черкаси, Небесної Сотні, 2".
 */
export function novaPostDivisionAddress(row: {
  address?: unknown
  ShortAddress?: unknown
  fullAddress?: unknown
}): string {
  const full = row.fullAddress
  if (full && typeof full === 'object') {
    const item = full as NpRow
    const parts = [str(item, 'settlement'), str(item, 'street'), str(item, 'building')].filter(Boolean)
    if (parts.length >= 2) return parts.join(', ')
  }
  const raw = (typeof row.address === 'string' ? row.address : typeof row.ShortAddress === 'string' ? row.ShortAddress : '').trim()
  return trimNovaPostPostalAddress(raw)
}

export function trimNovaPostPostalAddress(address: string): string {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean)
  let index = 0
  while (index < parts.length) {
    const part = parts[index]
    if (/^\d{4,6}$/.test(part) || /^(україна|ukraine)$/iu.test(part) || /область$/iu.test(part)) {
      index += 1
      continue
    }
    break
  }
  const rest = parts.slice(index)
  return rest.length ? rest.join(', ') : address.trim()
}

/** Public branch number: "Відділення №3" / "99/3" → "3". */
export function novaPostDivisionNumber(numberField: string, name: string): string {
  const fromName = name.match(/№\s*(\d+)/u)
  if (fromName) return fromName[1]
  const tail = numberField.split('/').pop()?.trim() ?? ''
  if (/^\d+$/.test(tail)) return tail
  const any = numberField.match(/(\d+)/)
  return any ? any[1] : ''
}

export function mapNovaPostWarehouses(rows: unknown): NovaPostWarehouse[] {
  if (!Array.isArray(rows)) return []
  const out: NovaPostWarehouse[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const item = row as NpRow
    const ref = str(item, 'id') || str(item, 'Ref')
    const name = str(item, 'name') || str(item, 'Description')
    if (!ref || !name) continue
    const rawNumber = str(item, 'number') || str(item, 'Number')
    const address = novaPostDivisionAddress(item)
    out.push({
      ref,
      name: novaPostDivisionTitle(name),
      number: novaPostDivisionNumber(rawNumber, name),
      address: address || novaPostDivisionTitle(name),
    })
  }
  return out
}

function divisionKind(name: string): number {
  const lower = name.toLowerCase()
  if (lower.includes('відділення')) return 0
  if (lower.includes('поштомат')) return 1
  return 2
}

/**
 * Numeric query "3" yields №3, then numbers that start with 3 (30, 31, 32),
 * then numbers that merely contain 3. Same bucket is ordered by the number.
 * An empty query returns branches in number order.
 */
export function rankNovaPostWarehouses(
  rows: NovaPostWarehouse[],
  query: string | null,
): NovaPostWarehouse[] {
  const q = (query ?? '').trim().toLowerCase()
  const numeric = /^\d+$/.test(q)
  const matched = rows.filter((row) => {
    if (!q) return true
    const number = row.number.toLowerCase()
    const name = row.name.toLowerCase()
    const address = row.address.toLowerCase()
    if (numeric) return number === q || number.startsWith(q) || number.includes(q)
    return name.includes(q) || address.includes(q) || number.includes(q)
  })
  const bucket = (number: string): number => {
    if (!numeric) return 0
    if (number === q) return 0
    if (number.startsWith(q)) return 1
    if (number.includes(q)) return 2
    return 3
  }
  matched.sort((a, b) => {
    const byBucket = bucket(a.number) - bucket(b.number)
    if (byBucket) return byBucket
    const aNum = Number(a.number)
    const bNum = Number(b.number)
    const aFinite = Number.isFinite(aNum)
    const bFinite = Number.isFinite(bNum)
    if (aFinite && bFinite && aNum !== bNum) return aNum - bNum
    if (aFinite !== bFinite) return aFinite ? -1 : 1
    const byKind = divisionKind(a.name) - divisionKind(b.name)
    if (byKind) return byKind
    return a.name.localeCompare(b.name, 'uk')
  })
  return matched.slice(0, DIVISION_RESULT_LIMIT)
}

export function resetNovaPostJwtCache(): void {
  jwtCache = null
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | dns.LookupAddress[],
  family?: number,
) => void

function lookupNovaPost(hostname: string, options: dns.LookupOptions, callback: LookupCallback): void {
  const all = Boolean(options.all)
  const done = (address: string) => {
    if (all) callback(null, [{ address, family: 4 }])
    else callback(null, address, 4)
  }
  const fail = (error: NodeJS.ErrnoException) => {
    if (all) callback(error, [])
    else callback(error, '', 4)
  }
  dns.lookup(hostname, { family: 4 }, (error, address) => {
    if (!error && address) {
      done(address)
      return
    }
    const resolver = new dns.Resolver({ timeout: 2500, tries: 2 })
    resolver.setServers(['1.1.1.1', '8.8.8.8'])
    resolver.resolve4(hostname, (fallbackError, addresses) => {
      if (fallbackError || !addresses?.[0]) {
        fail(fallbackError ?? error ?? Object.assign(new Error('dns'), { code: 'ENOTFOUND' }))
        return
      }
      done(addresses[0])
    })
  })
}

function isRetryableNetworkError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  return (
    code === 'EAI_AGAIN' ||
    code === 'ESERVFAIL' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_NODATA'
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type NovaPostRaw = { status: number; contentType: string; body: Buffer }

function novaPostRequest(
  method: 'GET' | 'POST',
  path: string,
  headers: Record<string, string>,
  body?: string,
): Promise<NovaPostRaw> {
  const requestPath = path.startsWith('/v.1.0') ? path : `/v.1.0${path.startsWith('/') ? path : `/${path}`}`
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: 'https:',
        hostname: NOVA_POST_HOST,
        servername: NOVA_POST_HOST,
        path: requestPath,
        method,
        headers: {
          ...headers,
          ...(body !== undefined ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        },
        lookup: lookupNovaPost as unknown as https.RequestOptions['lookup'],
        timeout: 12_000,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            contentType: String(res.headers['content-type'] ?? ''),
            body: Buffer.concat(chunks),
          })
        })
      },
    )
    req.on('timeout', () => {
      req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
    })
    req.on('error', reject)
    if (body !== undefined) req.write(body)
    req.end()
  })
}

async function novaPostCall(
  method: 'GET' | 'POST',
  path: string,
  headers: Record<string, string>,
  body?: string,
): Promise<NovaPostRaw> {
  let lastError: unknown
  for (let attempt = 1; attempt <= REQUEST_ATTEMPTS; attempt += 1) {
    try {
      return await novaPostRequest(method, path, headers, body)
    } catch (error) {
      lastError = error
      if (!isRetryableNetworkError(error) || attempt === REQUEST_ATTEMPTS) break
      await sleep(200 * attempt)
    }
  }
  const code = (lastError as NodeJS.ErrnoException | undefined)?.code
  logger.warn('[NovaPost] request failed', { path: path.split('?')[0], code: code || 'unknown' })
  throw Object.assign(new Error('fetch failed'), { cause: lastError })
}

function asArrayBuffer(body: Buffer): ArrayBuffer {
  return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer
}

export async function getNovaPostJwt(apiKey: string): Promise<string> {
  if (jwtCache && jwtCache.exp > Date.now()) return jwtCache.jwt
  const res = await novaPostCall(
    'GET',
    `/clients/authorization?apiKey=${encodeURIComponent(apiKey)}`,
    { Accept: 'application/json' },
  )
  if (res.status === 401) throw new Error('invalid_key')
  if (res.status < 200 || res.status >= 300) throw new Error(`Nova Post authorization HTTP ${res.status}`)
  const body = JSON.parse(res.body.toString('utf8')) as { jwt?: string }
  if (!body.jwt) throw new Error('invalid_key')
  jwtCache = { jwt: body.jwt, exp: Date.now() + 50 * 60 * 1000 }
  return body.jwt
}

export async function novaPostSend(
  method: 'GET' | 'POST',
  path: string,
  jwt: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; json?: unknown; buffer?: ArrayBuffer; contentType?: string }> {
  const headers: Record<string, string> = { Authorization: jwt, 'Accept-Language': 'uk' }
  const payload = body !== undefined ? JSON.stringify(body) : undefined
  if (payload !== undefined) headers['Content-Type'] = 'application/json'
  let res = await novaPostCall(method, path, headers, payload)
  if (res.status === 401 && method === 'POST') {
    res = await novaPostCall(method, path, { ...headers, Authorization: `Bearer ${jwt}` }, payload)
  }
  if (res.contentType.includes('pdf') || res.contentType.includes('octet-stream')) {
    return { ok: res.status >= 200 && res.status < 300, status: res.status, buffer: asArrayBuffer(res.body), contentType: res.contentType }
  }
  let json: unknown
  if (res.body.length) {
    try {
      json = JSON.parse(res.body.toString('utf8')) as unknown
    } catch {
      json = undefined
    }
  }
  return { ok: res.status >= 200 && res.status < 300, status: res.status, json, contentType: res.contentType }
}

async function novaPostGet(path: string, jwt: string): Promise<unknown> {
  const res = await novaPostCall('GET', path, { Authorization: jwt, 'Accept-Language': 'uk', Accept: 'application/json' })
  if (res.status === 401) {
    resetNovaPostJwtCache()
    throw new Error('invalid_key')
  }
  if (res.status < 200 || res.status >= 300) throw new Error(`Nova Post HTTP ${res.status}`)
  return JSON.parse(res.body.toString('utf8')) as unknown
}

export async function searchNovaPostSettlements(apiKey: string, query: string): Promise<NovaPostCity[]> {
  const jwt = await getNovaPostJwt(apiKey)
  const params = new URLSearchParams()
  params.append('countryCodes[]', 'UA')
  params.set('textSearch', query)
  params.set('limit', String(CITY_LIMIT))
  const body = (await novaPostGet(`/settlements?${params}`, jwt)) as { items?: unknown }
  return mapNovaPostCities(body.items, query)
}

async function fetchDivisionPage(
  jwt: string,
  settlementId: string,
  categories: string[],
  page: number,
): Promise<{ items: unknown[]; lastPage: number }> {
  const params = new URLSearchParams()
  params.append('countryCodes[]', 'UA')
  params.append('settlementIds[]', settlementId)
  for (const category of categories) params.append('divisionCategories[]', category)
  params.set('limit', String(DIVISION_PAGE_LIMIT))
  params.set('page', String(page))
  const body = (await novaPostGet(`/divisions?${params}`, jwt)) as { items?: unknown; last_page?: unknown }
  const lastPage = typeof body.last_page === 'number' && body.last_page > 0 ? body.last_page : 1
  return { items: Array.isArray(body.items) ? body.items : [], lastPage }
}

async function listDivisions(jwt: string, settlementId: string, categories: string[]): Promise<unknown[]> {
  const key = `${settlementId}|${categories.join(',')}`
  const cached = divisionCache.get(key)
  if (cached && cached.exp > Date.now()) return cached.items
  const first = await fetchDivisionPage(jwt, settlementId, categories, 1)
  const lastPage = Math.min(first.lastPage, DIVISION_PAGE_CAP)
  const items = [...first.items]
  if (lastPage > 1) {
    const rest = await Promise.all(
      Array.from({ length: lastPage - 1 }, (_, index) =>
        fetchDivisionPage(jwt, settlementId, categories, index + 2),
      ),
    )
    for (const page of rest) items.push(...page.items)
  }
  divisionCache.set(key, { exp: Date.now() + DIVISION_CACHE_MS, items })
  return items
}

export async function searchNovaPostDivisions(
  apiKey: string,
  settlementId: string,
  query: string | null,
): Promise<NovaPostWarehouse[]> {
  const jwt = await getNovaPostJwt(apiKey)
  const categories = query ? ['PostBranch', 'Postomat'] : ['PostBranch']
  const items = await listDivisions(jwt, settlementId, categories)
  return rankNovaPostWarehouses(mapNovaPostWarehouses(items), query)
}

/** Resolve one division through the same /divisions API. Empty settlementId means unresolved. */
export async function getNovaPostDivision(
  apiKey: string,
  divisionId: string,
): Promise<ReturnType<typeof readDivisionSettlement>> {
  const id = divisionId.trim()
  if (!id) return null
  try {
    const jwt = await getNovaPostJwt(apiKey)
    const params = new URLSearchParams()
    params.append('ids[]', id)
    params.set('limit', '5')
    const body = (await novaPostGet(`/divisions?${params}`, jwt)) as { items?: unknown }
    const items = Array.isArray(body.items) ? body.items : []
    return readDivisionSettlement(items[0])
  } catch {
    return null
  }
}
