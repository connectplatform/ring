/**
 * Nova Post v.1.0 branch locator.
 *
 * Portal keys are not API 2.0 keys. Flow:
 * GET https://api.novapost.com/v.1.0/clients/authorization?apiKey=
 * then Authorization: {jwt} on /settlements and /divisions.
 * The key and JWT never leave the server. JWT is cached for 50 minutes.
 */

export const NOVA_POST_API_BASE = 'https://api.novapost.com/v.1.0'

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

export function isNovaPostEnabled(): boolean {
  return Boolean(process.env.NOVAPOST_API_KEY?.trim())
}

export function novaPostApiKey(): string | null {
  const key = process.env.NOVAPOST_API_KEY?.trim()
  return key || null
}

/** City / branch query. Empty or shorter than 2 chars is not sent upstream. */
export function normalizeNovaPostQuery(raw: string | null | undefined): string | null {
  const q = (raw ?? '').trim().slice(0, 64)
  if (q.length < 2) return null
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

export function mapNovaPostCities(rows: unknown): NovaPostCity[] {
  if (!Array.isArray(rows)) return []
  const out: NovaPostCity[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const item = row as NpRow
    const ref = str(item, 'id') || str(item, 'Ref')
    const name = str(item, 'name') || str(item, 'Description')
    if (!ref || !name) continue
    out.push({ ref, name, area: regionName(item) || str(item, 'AreaDescription') })
    if (out.length >= 20) break
  }
  return out
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
    out.push({
      ref,
      name,
      number: str(item, 'number') || str(item, 'Number'),
      address: str(item, 'address') || str(item, 'ShortAddress') || name,
    })
    if (out.length >= 30) break
  }
  return out
}

export function resetNovaPostJwtCache(): void {
  jwtCache = null
}

export async function getNovaPostJwt(apiKey: string): Promise<string> {
  if (jwtCache && jwtCache.exp > Date.now()) return jwtCache.jwt
  const res = await fetch(
    `${NOVA_POST_API_BASE}/clients/authorization?apiKey=${encodeURIComponent(apiKey)}`,
    { cache: 'no-store' },
  )
  if (res.status === 401) throw new Error('invalid_key')
  if (!res.ok) throw new Error(`Nova Post authorization HTTP ${res.status}`)
  const body = (await res.json()) as { jwt?: string }
  if (!body.jwt) throw new Error('invalid_key')
  jwtCache = { jwt: body.jwt, exp: Date.now() + 50 * 60 * 1000 }
  return body.jwt
}

async function novaPostGet(path: string, jwt: string): Promise<unknown> {
  const res = await fetch(`${NOVA_POST_API_BASE}${path}`, {
    headers: { Authorization: jwt, 'Accept-Language': 'uk' },
    cache: 'no-store',
  })
  if (res.status === 401) {
    resetNovaPostJwtCache()
    throw new Error('invalid_key')
  }
  if (!res.ok) throw new Error(`Nova Post HTTP ${res.status}`)
  return res.json()
}

export async function searchNovaPostSettlements(apiKey: string, query: string): Promise<NovaPostCity[]> {
  const jwt = await getNovaPostJwt(apiKey)
  const params = new URLSearchParams()
  params.append('countryCodes[]', 'UA')
  params.set('textSearch', query)
  params.set('limit', '20')
  const body = (await novaPostGet(`/settlements?${params}`, jwt)) as { items?: unknown }
  return mapNovaPostCities(body.items)
}

export async function searchNovaPostDivisions(
  apiKey: string,
  settlementId: string,
  query: string | null,
): Promise<NovaPostWarehouse[]> {
  const jwt = await getNovaPostJwt(apiKey)
  const params = new URLSearchParams()
  params.append('countryCodes[]', 'UA')
  params.append('settlementIds[]', settlementId)
  params.append('divisionCategories[]', 'PostBranch')
  params.append('divisionCategories[]', 'Postomat')
  params.set('limit', '30')
  const body = (await novaPostGet(`/divisions?${params}`, jwt)) as { items?: unknown }
  const rows = mapNovaPostWarehouses(body.items)
  if (!query) return rows
  const needle = query.toLowerCase()
  return rows.filter(
    (row) =>
      row.name.toLowerCase().includes(needle) ||
      row.number.toLowerCase().includes(needle) ||
      row.address.toLowerCase().includes(needle),
  )
}
