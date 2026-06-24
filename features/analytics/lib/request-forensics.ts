import 'server-only'

import { headers } from 'next/headers'

export interface RequestForensicsContext {
  ip: string | null
  userAgent: string | null
  referer: string | null
  requestUrl: string | null
  requestPath: string | null
}

/** SSOT: request context from proxy `x-pathname` / `x-url` + referer. */
export async function getRequestForensicsContext(): Promise<RequestForensicsContext> {
  try {
    const h = await headers()
    return {
      ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip'),
      userAgent: h.get('user-agent'),
      referer: h.get('referer'),
      requestUrl: h.get('x-url'),
      requestPath: h.get('x-pathname'),
    }
  } catch {
    return {
      ip: null,
      userAgent: null,
      referer: null,
      requestUrl: null,
      requestPath: null,
    }
  }
}
