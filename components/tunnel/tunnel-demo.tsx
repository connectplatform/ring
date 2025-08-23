/**
 * Tunnel Transport Demo Component
 * Demonstrates usage of the tunnel transport abstraction layer
 */

'use client';

import { useEffect, useState } from 'react';
import { useTunnel, useTunnelNotifications, useTunnelMessages } from '@/hooks/use-tunnel';
import { TunnelProvider } from '@/lib/tunnel/types';

export function TunnelDemo() {
  const [testChannel] = useState('demo-channel');
  const [messageText, setMessageText] = useState('');
  
  // Main tunnel hook
  const {
    isConnected,
    connectionState,
    provider,
    health,
    latency,
    availableProviders,
    publish,
    subscribe,
    switchProvider,
    error,
  } = useTunnel({
    autoConnect: true,
    debug: true,
  });

  // Notifications hook
  const { notifications, clearNotifications } = useTunnelNotifications();

  // Messages hook
  const { messages, sendMessage } = useTunnelMessages(testChannel);

  // Subscribe to test channel
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe(testChannel, (message) => {
      console.log('Received message:', message);
    });

    return unsubscribe;
  }, [isConnected, testChannel, subscribe]);

  // Send test message
  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    try {
      await publish(testChannel, 'message', {
        text: messageText,
        timestamp: Date.now(),
        user: 'demo-user',
      });
      
      setMessageText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Send notification
  const handleSendNotification = async () => {
    try {
      await publish('notifications', 'notification', {
        title: 'Test Notification',
        body: 'This is a test notification from the tunnel transport demo',
        timestamp: Date.now(),
        priority: 'normal',
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  };

  // Switch transport provider
  const handleSwitchProvider = async (newProvider: TunnelProvider) => {
    try {
      await switchProvider(newProvider);
    } catch (error) {
      console.error('Failed to switch provider:', error);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Tunnel Transport Demo</h2>
        
        {/* Connection Status */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded">
          <h3 className="font-semibold mb-2">Connection Status</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Status: <span className={isConnected ? 'text-green-600' : 'text-red-600'}>{connectionState}</span></div>
            <div>Provider: <span className="font-mono">{provider || 'none'}</span></div>
            <div>Latency: <span className="font-mono">{latency}ms</span></div>
            <div>Uptime: <span className="font-mono">{health?.uptime || 0}s</span></div>
          </div>
          {error && (
            <div className="mt-2 text-red-600 text-sm">
              Error: {error.message}
            </div>
          )}
        </div>

        {/* Provider Selection */}
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Available Providers</h3>
          <div className="flex flex-wrap gap-2">
            {availableProviders.map((p) => (
              <button
                key={p}
                onClick={() => handleSwitchProvider(p)}
                className={`px-3 py-1 rounded text-sm ${
                  provider === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
                disabled={!isConnected}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Message Sending */}
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Send Message</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              disabled={!isConnected}
            />
            <button
              onClick={handleSendMessage}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={!isConnected || !messageText.trim()}
            >
              Send
            </button>
          </div>
        </div>

        {/* Messages Display */}
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Messages ({messages.length})</h3>
          <div className="h-40 overflow-y-auto border rounded p-2 dark:bg-gray-900 dark:border-gray-700">
            {messages.length === 0 ? (
              <div className="text-gray-500 text-sm">No messages yet...</div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="mb-1 text-sm">
                  <span className="text-gray-500">{new Date(msg.metadata?.timestamp || 0).toLocaleTimeString()}</span>
                  {' - '}
                  <span>{msg.payload?.text || JSON.stringify(msg.payload)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Notifications ({notifications.length})</h3>
            <div className="flex gap-2">
              <button
                onClick={handleSendNotification}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                disabled={!isConnected}
              >
                Send Test
              </button>
              <button
                onClick={clearNotifications}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                disabled={notifications.length === 0}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {notifications.map((notif) => (
              <div key={notif.id} className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm">
                <div className="font-semibold">{notif.payload?.title}</div>
                <div className="text-gray-600 dark:text-gray-400">{notif.payload?.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Health Metrics */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded">
          <h3 className="font-semibold mb-2">Health Metrics</h3>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>Messages Sent: <span className="font-mono">{health?.messagesSent || 0}</span></div>
            <div>Messages Received: <span className="font-mono">{health?.messagesReceived || 0}</span></div>
            <div>Errors: <span className="font-mono">{health?.errors || 0}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
