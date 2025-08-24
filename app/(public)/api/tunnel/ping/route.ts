/**
 * Tunnel Ping Endpoint
 * Simple ping endpoint for latency measurement
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/edge-jwt';

// Edge Runtime configuration
export const runtime = 'edge';

/**
 * POST handler for ping/pong
 */
export async function POST(request: NextRequest) {
  // Authenticate the request
  const authResult = await verifyAuth(request);
  
  if (!authResult) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    pong: true,
    timestamp: Date.now(),
    userId: authResult.userId,
  });
}
