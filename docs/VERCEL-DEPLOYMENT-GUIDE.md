# Vercel Deployment Guide for Tunnel Transport

## Overview

Vercel's Edge Runtime doesn't support WebSocket connections. The Tunnel Transport system automatically handles this, but you need to configure it properly for production.

## Environment Variables

Add these environment variables to your Vercel project:

### Required Variables

```bash
# Force SSE transport on Vercel (WebSocket not supported)
NEXT_PUBLIC_TUNNEL_TRANSPORT=sse

# Fallback chain for Vercel
NEXT_PUBLIC_TUNNEL_FALLBACK_CHAIN=sse,polling

# Disable WebSocket attempts
NEXT_PUBLIC_TUNNEL_WEBSOCKET_ENABLED=false
```

### Optional: Use Supabase for Better Performance (Recommended)

If you have a Supabase project, use it as the primary transport for 4x faster performance:

```bash
# Use Supabase as primary transport
NEXT_PUBLIC_TUNNEL_TRANSPORT=supabase
NEXT_PUBLIC_TUNNEL_FALLBACK_CHAIN=supabase,sse,polling

# Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Optional: Alternative Providers

```bash
# Pusher
PUSHER_KEY=your-pusher-key
PUSHER_SECRET=your-pusher-secret
PUSHER_APP_ID=your-pusher-app-id
PUSHER_CLUSTER=us2

# Ably
ABLY_API_KEY=your-ably-api-key
```

### Performance Settings

```bash
# Retry configuration
NEXT_PUBLIC_TUNNEL_RETRY_ENABLED=true
NEXT_PUBLIC_TUNNEL_MAX_RECONNECT_ATTEMPTS=5
NEXT_PUBLIC_TUNNEL_RECONNECT_DELAY=2000

# Heartbeat interval (milliseconds)
NEXT_PUBLIC_TUNNEL_HEARTBEAT_INTERVAL=30000

# Debug mode (set to false in production)
NEXT_PUBLIC_TUNNEL_DEBUG=false
```

## How to Add Environment Variables to Vercel

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with its value
4. Select the environments (Production, Preview, Development)
5. Save and redeploy

## Verification

After deployment, test the configuration:

1. Visit `/api/tunnel/test` to see the detected configuration
2. Visit `/tunnel-test` to test real-time functionality
3. Check the browser console for connection status

## Expected Behavior on Vercel

- **Transport**: SSE (Server-Sent Events) or Supabase
- **No WebSocket errors**: The system won't attempt WebSocket connections
- **Automatic fallback**: If SSE fails, it falls back to long-polling
- **Real-time updates**: Work through SSE streaming or Supabase

## Troubleshooting

### Still seeing WebSocket errors?

Make sure `NEXT_PUBLIC_TUNNEL_TRANSPORT` is set to `sse` or `supabase`, not `auto`.

### Rate limiting (429 errors)?

This is likely from the old WebSocket implementation. The tunnel transport uses different auth endpoints that shouldn't hit rate limits.

### Firebase errors?

The Firebase service worker errors are separate from the tunnel transport. If you're not using Firebase for notifications, you can ignore these or disable Firebase messaging.

## Performance Comparison

| Transport | Latency | Throughput | Edge Compatible | Notes |
|-----------|---------|------------|-----------------|-------|
| WebSocket | <50ms | 10,000 msg/s | ❌ | Not available on Vercel |
| Supabase | <50ms | 5,000 msg/s | ✅ | Best for Vercel (4x faster reads) |
| SSE | <100ms | 1,000 msg/s | ✅ | Good fallback option |
| Long-polling | <2000ms | 100 msg/s | ✅ | Universal fallback |

## Recommended Configuration for Vercel

For best performance on Vercel, we recommend:

1. **With Supabase** (Best):
   - Primary: Supabase
   - Fallback: SSE → Long-polling

2. **Without Supabase** (Good):
   - Primary: SSE
   - Fallback: Long-polling

Both configurations provide reliable real-time communication without WebSocket errors.
