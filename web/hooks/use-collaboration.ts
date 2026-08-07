/**
 * Collaboration hook — Y.js doc over Ring Tunnel (requires non-vercel deploy target).
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { getProviderConnectionOptions } from '@/lib/tunnel/config';
import { isNativeWssEnabled } from '@/lib/tunnel/deploy-target';
import { YjsTunnelProvider } from '@/lib/tunnel/crdt/yjs-tunnel-provider';
import { NativeWsClient } from '@/lib/tunnel/native-ws/client';
import { TunnelProvider } from '@/lib/tunnel/types';

export interface CollaborationState {
  doc: Y.Doc | null;
  connected: boolean;
  enabled: boolean;
  error: string | null;
}

export function useCollaboration(publicationId: string): CollaborationState {
  const collabEnabled = process.env.NEXT_PUBLIC_COLLAB_ENABLED === 'true';
  const wssEnabled = isNativeWssEnabled();
  const enabled = collabEnabled && wssEnabled;

  const docRef = useRef<Y.Doc | null>(null);
  const clientRef = useRef<NativeWsClient | null>(null);
  const providerRef = useRef<YjsTunnelProvider | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !publicationId) return;

    if (!docRef.current) {
      docRef.current = new Y.Doc();
    }

    const channel = `collab:${publicationId}`;
    let cancelled = false;

    const setup = async () => {
      try {
        const options = getProviderConnectionOptions(TunnelProvider.WEBSOCKET);
        const client = new NativeWsClient({ url: options.url! });
        await client.connect();

        if (cancelled) {
          client.disconnect();
          return;
        }

        clientRef.current = client;
        providerRef.current = new YjsTunnelProvider({
          doc: docRef.current!,
          channel,
          wsClient: client,
        });
        setConnected(true);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Collaboration setup failed');
        }
      }
    };

    void setup();

    return () => {
      cancelled = true;
      providerRef.current?.destroy();
      providerRef.current = null;
      clientRef.current?.disconnect();
      clientRef.current = null;
      setConnected(false);
    };
  }, [enabled, publicationId]);

  if (!enabled) {
    return { doc: null, connected: false, enabled: false, error: null };
  }

  return {
    doc: docRef.current,
    connected,
    enabled: true,
    error,
  };
}
