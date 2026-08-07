/**
 * Tunnel Transport Test Endpoint
 * Simple test endpoint to verify tunnel transport functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTunnelTransportManager } from '@/lib/tunnel/transport-manager';
import { detectEnvironment, detectProviderCredentials } from '@/lib/tunnel/config';
import { TunnelProvider } from '@/lib/tunnel/types';

// Edge Runtime configuration

/**
 * GET handler to test tunnel transport configuration
 */
export async function GET(request: NextRequest) {
  try {
    // Detect environment
    const env = detectEnvironment();
    
    // Detect available providers
    const availableProviders = Array.from(detectProviderCredentials());
    
    // Get transport manager
    const manager = getTunnelTransportManager();
    
    // Get current configuration
    const currentProvider = manager.getProvider();
    const connectionState = manager.getConnectionState();
    const isConnected = manager.isConnected();
    const health = manager.getHealth();
    
    // Test results
    const testResults = {
      environment: {
        ...env,
        runtime: process.env.NEXT_RUNTIME || 'node',
      },
      availableProviders,
      recommendedProvider: availableProviders[0] || TunnelProvider.LONG_POLLING,
      currentConfiguration: {
        provider: currentProvider,
        connectionState,
        isConnected,
        health,
      },
      capabilities: {
        websocket: availableProviders.includes(TunnelProvider.WEBSOCKET),
        sse: availableProviders.includes(TunnelProvider.SSE),
        supabase: availableProviders.includes(TunnelProvider.SUPABASE),
        firebase: availableProviders.includes(TunnelProvider.FIREBASE),
        firebaseEdge: availableProviders.includes(TunnelProvider.FIREBASE_EDGE),
        pusher: availableProviders.includes(TunnelProvider.PUSHER),
        ably: availableProviders.includes(TunnelProvider.ABLY),
        polling: true, // Always available
      },
      status: 'ready',
      message: `Tunnel transport ready with ${availableProviders.length} available providers`,
    };

    return NextResponse.json(testResults);
  } catch (error) {
    console.error('Tunnel transport test failed:', error);
    
    return NextResponse.json(
      {
        error: 'Test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      },
      { status: 500 }
    );
  }
}
