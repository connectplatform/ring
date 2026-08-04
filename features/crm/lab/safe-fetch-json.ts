/**
 * Safe JSON fetch for Order Lab panels — never throws on empty bodies
 * (`SyntaxError: Unexpected end of JSON input` digests in prod).
 */
export type SafeJsonResult<T> = {
  ok: boolean
  status: number
  data: T | null
  error?: string
}

export async function fetchJsonSafe<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<SafeJsonResult<T>> {
  const res = await fetch(input, init)
  const text = await res.text()
  if (!text.trim()) {
    return {
      ok: res.ok,
      status: res.status,
      data: null,
      error: res.ok ? 'Empty response' : `HTTP ${res.status}`,
    }
  }
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) as T }
  } catch {
    return {
      ok: false,
      status: res.status,
      data: null,
      error: `Invalid JSON (HTTP ${res.status})`,
    }
  }
}

/** Parse an already-fetched Response without throwing on empty/invalid bodies. */
export async function parseResponseJsonSafe<T = unknown>(
  res: Response,
): Promise<SafeJsonResult<T>> {
  const textBody = await res.text()
  if (!textBody.trim()) {
    return {
      ok: res.ok,
      status: res.status,
      data: null,
      error: res.ok ? 'Empty response' : `HTTP ${res.status}`,
    }
  }
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(textBody) as T }
  } catch {
    return {
      ok: false,
      status: res.status,
      data: null,
      error: `Invalid JSON (HTTP ${res.status})`,
    }
  }
}
