/**
 * Tunnel Disconnect Endpoint
 * Handles client disconnection from tunnel transport
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // This endpoint is mainly for cleanup purposes
    // The actual disconnection is handled client-side
    
    // You could add server-side cleanup here if needed
    // For example, removing from presence lists, clearing subscriptions, etc.
    
    return NextResponse.json({ 
      success: true,
      message: 'Disconnected successfully'
    });
  } catch (error) {
    console.error('Disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}

// Also support GET for compatibility
export async function GET(req: NextRequest) {
  return POST(req);
}
