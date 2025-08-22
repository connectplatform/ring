import { NextResponse } from 'next/server'

// Minimal analytics endpoint - avoid heavy imports to reduce compilation time
export async function POST() {
  // In development, just acknowledge the request
  // In production, this would forward to analytics service
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.json({ ok: true })
  }
  
  // TODO: Implement production analytics forwarding
  return NextResponse.json({ ok: true })
}

// Use edge runtime for faster cold starts and lower compilation overhead
export const runtime = 'edge'


