/**
 * Tunnel Heartbeat Endpoint
 * Handles heartbeat/ping requests for connection health monitoring
 */

import { NextRequest, NextResponse } from 'next/server';

// Edge Runtime configuration

/**
 * POST handler for heartbeat/ping
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { timestamp = Date.now() } = body;
    
    return NextResponse.json({
      success: true,
      timestamp,
      serverTime: Date.now(),
      latency: Date.now() - timestamp,
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return NextResponse.json(
      { error: 'Heartbeat failed' },
      { status: 500 }
    );
  }
}

/**
 * GET handler for simple ping
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    timestamp: Date.now(),
  });
}
