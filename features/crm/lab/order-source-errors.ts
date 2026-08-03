import { NextResponse } from 'next/server'
import { ForgejoApiError } from '@/features/crm/lab/forgejo-api-client'
import {
  SourceConflict,
  SourceNotScaffolded,
  SourcePathDenied,
} from '@/features/crm/lab/order-source-service'

/** Map Order Source domain errors to stable JSON responses. */
export function sourceErrorResponse(err: unknown): NextResponse {
  if (err instanceof SourceNotScaffolded) {
    return NextResponse.json(
      { success: false, error: err.message, code: err.code },
      { status: 409 },
    )
  }
  if (err instanceof SourceConflict) {
    return NextResponse.json(
      { success: false, error: err.message, code: err.code },
      { status: 409 },
    )
  }
  if (err instanceof SourcePathDenied) {
    return NextResponse.json(
      { success: false, error: err.message, code: err.code },
      { status: 403 },
    )
  }
  if (err instanceof ForgejoApiError) {
    const status = err.status === 503 ? 503 : err.status >= 400 && err.status < 600 ? err.status : 502
    return NextResponse.json(
      { success: false, error: err.message, code: 'FORGEJO_ERROR' },
      { status },
    )
  }
  const message = err instanceof Error ? err.message : 'Source request failed'
  return NextResponse.json({ success: false, error: message }, { status: 400 })
}
