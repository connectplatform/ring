/**
 * Stable guest tunnel identity via httpOnly cookie `ring_tunnel_anon`.
 * Shared by /api/tunnel/token and /api/tunnel/subscribe.
 */

import type { NextRequest, NextResponse } from 'next/server'

export const TUNNEL_ANON_COOKIE = 'ring_tunnel_anon'

function newAnonymousId(): string {
  return `anon-${Math.random().toString(36).slice(2, 11)}`
}

export function resolveAnonymousTunnelId(request: NextRequest): {
  id: string
  isNew: boolean
} {
  const existing = request.cookies.get(TUNNEL_ANON_COOKIE)?.value?.trim()
  if (existing && existing.startsWith('anon-') && existing.length <= 64) {
    return { id: existing, isNew: false }
  }
  return { id: newAnonymousId(), isNew: true }
}

export function attachAnonymousTunnelCookie(
  response: NextResponse,
  anonymousId: string,
): void {
  response.cookies.set(TUNNEL_ANON_COOKIE, anonymousId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === 'production',
  })
}
