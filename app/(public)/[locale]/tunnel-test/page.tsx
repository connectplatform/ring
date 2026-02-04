/**
 * Tunnel Transport Test Page
 * Test page for verifying tunnel transport functionality
 */

import { TunnelDemo } from '@/components/tunnel/tunnel-demo';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tunnel Transport Test',
  description: 'Test page for tunnel transport abstraction layer',
};

export default function TunnelTestPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">
          Tunnel Transport Test
        </h1>
        
        <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">About This Test</h2>
            <p className="text-muted-foreground mb-4">
            This page demonstrates the Tunnel Transport Abstraction Layer, which provides
            automatic transport selection and fallback for real-time communication.
          </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Automatically detects and uses the best transport for your environment</li>
            <li>Seamlessly falls back to alternative transports on failure</li>
            <li>Works on Vercel Edge Runtime, Firebase, and self-hosted deployments</li>
            <li>Supports WebSocket, SSE, Supabase, Firebase, Pusher, Ably, and HTTP polling</li>
          </ul>
        </div>

        <TunnelDemo />
        
        <div className="mt-8 p-6 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">API Test Endpoint</h2>
            <p className="text-muted-foreground mb-4">
            You can also test the tunnel transport configuration via the API:
          </p>
          <code className="block p-3 bg-gray-900 text-green-400 rounded">
            GET /api/tunnel/test
          </code>
        </div>
      </div>
    </div>
  );
}
