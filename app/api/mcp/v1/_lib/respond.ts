import { NextResponse } from 'next/server'

export function mcpOk<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function mcpError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

export function mcpFromResult(
  result: { success: boolean; data?: unknown; error?: string },
  okStatus = 200
) {
  if (!result.success) {
    return mcpError(result.error || 'Operation failed', 400)
  }
  return mcpOk(result.data, okStatus)
}
