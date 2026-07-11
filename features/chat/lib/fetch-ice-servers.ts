import { apiClient, type ApiResponse } from '@/lib/api-client'

/**
 * Authenticated ICE config from GET /api/webrtc/ice-servers.
 * TURN credentials stay server-side — never NEXT_PUBLIC_*.
 */
export async function fetchIceServers(): Promise<{
  iceServers: RTCIceServer[]
  turnConfigured: boolean
}> {
  const res: ApiResponse<{
    iceServers: RTCIceServer[]
    turnConfigured: boolean
  }> = await apiClient.get('/api/webrtc/ice-servers', {
    timeout: 8000,
    retries: 1,
  })

  if (!res.success || !res.data?.iceServers?.length) {
    throw new Error(res.error || 'ICE servers unavailable')
  }

  return {
    iceServers: res.data.iceServers,
    turnConfigured: Boolean(res.data.turnConfigured),
  }
}
