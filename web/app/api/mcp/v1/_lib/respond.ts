import { NextResponse } from 'next/server'

/**
 * Sends a JSON response indicating a successful operation.
 * @param data - The payload to return on success.
 * @param status - Optional HTTP status code (default 200).
 * @returns NextResponse object with { success: true, data }
 */
export function mcpOk<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
  // TODO: Consider using the Response constructor directly for greater control if required.
}

/**
 * Sends a JSON response indicating an error.
 * @param error - Error message string.
 * @param status - Optional HTTP status code (default 400).
 * @returns NextResponse object with { success: false, error }
 */
export function mcpError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
  // TODO: Consider enhanced error handling or supporting more error structure if needed.
}

/**
 * Convenience function that handles an "operation result" shape and returns
 * a standardized API response. If result.success is false, returns an error automatically.
 * @param result - An object with at least a success property, optionlly error and data.
 * @param okStatus - HTTP status for a successful response (default 200).
 * @returns Response for success with data or error with message.
 */
export function mcpFromResult(
  result: { success: boolean; data?: unknown; error?: string },
  okStatus = 200
) {
  if (!result.success) {
    // If the operation wasn't successful, return an error response.
    return mcpError(result.error || 'Operation failed', 400)
  }
  // Otherwise, return a success response with the data.
  return mcpOk(result.data, okStatus)
  // TODO: If using Next.js 16+ Route Handlers, validate result/data structure more robustly.
}
