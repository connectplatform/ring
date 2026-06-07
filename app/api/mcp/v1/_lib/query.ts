import type { NextRequest } from 'next/server'

export function queryInt(request: NextRequest, key: string, fallback?: number): number | undefined {
  const raw = request.nextUrl.searchParams.get(key)
  if (raw == null || raw === '') return fallback
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) ? value : fallback
}

export function queryString(request: NextRequest, key: string): string | undefined {
  const value = request.nextUrl.searchParams.get(key)
  return value == null || value === '' ? undefined : value
}

export async function readJsonBody<T = Record<string, unknown>>(request: NextRequest): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    return {} as T
  }
}
