# Connect Platform TypeScript SDK

Modern, type-safe TypeScript SDK for Connect Platform - the Erlang-based real-time messaging and communication platform.

## Features

- 🔐 **Complete Authentication** - Phone, social login, JWT tokens
- 💬 **Real-time Messaging** - WebSocket support with auto-reconnect
- 👥 **Contact Management** - Find users, add contacts, manage relationships
- 🏢 **Business Profiles** - Create and manage entity profiles via Feed Posts
- 🔄 **LiberateSynapse** - Advanced live data streaming
- ⚡ **High Performance** - BERT encoding, connection pooling, caching
- 🛡️ **Type Safety** - Full TypeScript support with comprehensive types
- 🔧 **Easy Integration** - Simple API, event-driven architecture

## Installation

```bash
npm install @ring-platform/connect-sdk
# or
yarn add @ring-platform/connect-sdk
```

## Quick Start

```typescript
import { createConnectSDK } from '@ring-platform/connect-sdk';

// Initialize SDK
const sdk = createConnectSDK({
  httpUrl: 'https://api.connectplatform.com',
  wsUrl: 'wss://ws.connectplatform.com',
  version: 'v7',
  debug: true
});

// Authenticate with phone
await sdk.requestVerification('+1234567890');
const { token, user } = await sdk.confirmVerification('+1234567890', '123456');

// Connect WebSocket for real-time features
await sdk.connect();

// Send a message
const message = await sdk.sendMessage('user123', 'Hello from Ring Platform!');

// Listen for incoming messages
sdk.on('messageReceived', (message, feedId) => {
  console.log('New message:', message.payload);
});
```

## Authentication

### Phone Authentication

```typescript
// Step 1: Request SMS verification
await sdk.requestVerification('+1234567890', 'mobile');

// Step 2: Confirm with SMS code
const { token, user } = await sdk.confirmVerification(
  '+1234567890', 
  '123456',
  {
    os: 'web',
    deviceId: 'unique-device-id',
    deviceName: 'Chrome Browser'
  }
);

console.log('Authenticated as:', user.name);
```

### Social Authentication

```typescript
// Authenticate with Google
const { token, user } = await sdk.socialAuth('google', googleAccessToken);

// Authenticate with Facebook
const { token, user } = await sdk.socialAuth('facebook', fbAccessToken);
```

## User Management

```typescript
// Get current user profile
const profile = await sdk.getCurrentUser();

// Update user profile
const updatedUser = await sdk.updateUser({
  name: 'John Doe',
  bio: 'Professional networker',
  photo: 'https://example.com/photo.jpg'
});

// Find users
const users = await sdk.findUsers({
  name: 'John',
  isVendor: true
});
```

## Messaging

### Send Messages

```typescript
// Send text message
const message = await sdk.sendMessage('user123', 'Hello!');

// Send message with media
const richMessage = await sdk.sendMessage('user123', 'Check this out!', {
  media: [{
    type: 'image',
    link: 'https://example.com/image.jpg',
    thumbnail: 'https://example.com/thumb.jpg',
    width: 1920,
    height: 1080
  }]
});

// Send location
const locationMessage = await sdk.sendMessage('user123', 'Meet me here', {
  location: [40.7128, -74.0060] // NYC coordinates
});

// Reply to message
const reply = await sdk.sendMessage('user123', 'I agree!', {
  replyTo: 'message123'
});
```

### Retrieve Messages

```typescript
// Get conversation history
const messages = await sdk.getMessages('user123', {
  limit: 50,
  before: 'message123' // Pagination
});

// Get room messages
const roomMessages = await sdk.getMessages('room456', {
  feedType: 'room',
  limit: 100
});
```

### Real-time Features

```typescript
// Send typing indicator
await sdk.sendTyping('user123');

// Mark messages as read
await sdk.markAsRead('user123');

// Listen for real-time updates
sdk.on('messageReceived', (message, feedId) => {
  console.log(`New message in ${feedId}:`, message.payload);
});

sdk.on('chatUpdate', (update) => {
  console.log('Chat update:', update);
});
```

## Business Profiles (Feed Posts)

Create and manage business profiles using the Feed Post system:

```typescript
// Create business profile
const businessProfile = await sdk.createFeedPost({
  type: 'business_profile',
  title: 'Acme Corporation',
  descr: 'Leading technology solutions provider',
  categories: ['technology', 'consulting'],
  tags: ['software', 'innovation', 'enterprise'],
  location: [37.7749, -122.4194], // San Francisco
  media: [{
    type: 'image',
    link: 'https://example.com/logo.png',
    caption: 'Company Logo'
  }]
});

// Search business profiles
const { posts, total } = await sdk.getFeedPosts({
  categories: ['technology'],
  location: [37.7749, -122.4194],
  distance: 10, // 10km radius
  limit: 20
});

// Like a business profile
await sdk.likeFeedPost('post123');
```

## Advanced Features

### LiberateSynapse - Live Data Streaming

```typescript
// Create a live presentation stream
const streamId = await sdk.createSynapseStream({
  type: 'presentation',
  targetId: 'conference-room-123',
  streams: [
    { type: 'video', id: 'camera-1', label: 'Main Camera' },
    { type: 'audio', id: 'mic-1', label: 'Microphone' },
    { type: 'screen', id: 'screen-1', label: 'Screen Share' }
  ],
  includeOwnStream: true
});

// Listen for synapse discovery
sdk.on('synapseDiscovered', (synapse) => {
  console.log('New data stream:', synapse.metadata);
  // Process the binary stream data
  processStreamData(synapse.data);
});
```

## Event Handling

The SDK extends EventEmitter and provides comprehensive event handling:

```typescript
// Connection events
sdk.on('connected', () => {
  console.log('WebSocket connected');
});

sdk.on('disconnected', (reason) => {
  console.log('WebSocket disconnected:', reason);
});

// Message events
sdk.on('messageReceived', (message, feedId) => {
  console.log('New message:', message);
});

// User events
sdk.on('contactChanged', (contact) => {
  console.log('Contact updated:', contact);
});

sdk.on('userStatusChanged', (status) => {
  console.log('User status:', status);
});

// Error handling
sdk.on('error', (error) => {
  console.error('SDK error:', error);
});

// Rate limiting
sdk.on('rateLimit', (retryAfter) => {
  console.log(`Rate limited. Retry after ${retryAfter} seconds`);
});
```

## Integration with Ring Platform

Example integration with Ring Platform's messaging system:

```typescript
import { createConnectSDK } from '@ring-platform/connect-sdk';
import { useMessaging } from '@/hooks/use-messaging';

export function ConnectPlatformProvider({ children }) {
  const [sdk, setSdk] = useState<ConnectPlatformSDK | null>(null);
  const { addMessage, updateConversation } = useMessaging();

  useEffect(() => {
    const connectSdk = createConnectSDK({
      httpUrl: process.env.NEXT_PUBLIC_CONNECT_HTTP_URL!,
      wsUrl: process.env.NEXT_PUBLIC_CONNECT_WS_URL!,
      accessToken: session?.connectToken
    });

    // Set up event handlers
    connectSdk.on('messageReceived', (message, feedId) => {
      addMessage({
        id: message.id,
        conversationId: feedId,
        content: message.payload,
        senderId: message.origin,
        createdAt: new Date(message.created * 1000)
      });
    });

    connectSdk.on('chatUpdate', (update) => {
      updateConversation(update.feedId, {
        lastMessage: update.top,
        unreadCount: update.unread
      });
    });

    // Connect WebSocket
    connectSdk.connect();
    setSdk(connectSdk);

    return () => {
      connectSdk.disconnect();
    };
  }, [session]);

  return (
    <ConnectContext.Provider value={sdk}>
      {children}
    </ConnectContext.Provider>
  );
}
```

## Configuration Options

```typescript
interface ConnectSDKConfig {
  httpUrl: string;        // HTTP API endpoint
  wsUrl: string;          // WebSocket endpoint
  accessToken?: string;   // Authentication token
  version?: string;       // API version (default: 'v7')
  ssl?: boolean;          // Use SSL (default: true)
  debug?: boolean;        // Enable debug logging
  autoReconnect?: boolean; // Auto-reconnect WebSocket (default: true)
  reconnectInterval?: number; // Reconnect interval in ms (default: 5000)
}
```

## Error Handling

The SDK provides comprehensive error handling:

```typescript
try {
  await sdk.sendMessage('user123', 'Hello');
} catch (error) {
  if (error.message.includes('rate_limited')) {
    // Handle rate limiting
    console.log('Too many requests');
  } else if (error.message.includes('auth_required')) {
    // Handle authentication errors
    await sdk.requestVerification(phoneNumber);
  } else {
    // Handle other errors
    console.error('Failed to send message:', error);
  }
}
```

## TypeScript Support

The SDK is fully typed with comprehensive TypeScript definitions:

```typescript
import { 
  ConnectUser, 
  ConnectMessage, 
  FeedPost, 
  MediaEntity,
  ConnectEventMap 
} from '@ring-platform/connect-sdk';

// Type-safe event handling
sdk.on<keyof ConnectEventMap>('messageReceived', (message, feedId) => {
  // message is typed as ConnectMessage
  // feedId is typed as string
});

// Type-safe API calls
const user: ConnectUser = await sdk.getCurrentUser();
const messages: ConnectMessage[] = await sdk.getMessages('user123');
```

## Performance Tips

1. **Connection Pooling**: The SDK automatically manages HTTP connection pooling
2. **Message Batching**: For bulk operations, use Promise.all()
3. **Caching**: Implement caching for frequently accessed data
4. **Pagination**: Use cursor-based pagination for large datasets

```typescript
// Efficient bulk operations
const messagePromises = recipients.map(recipient =>
  sdk.sendMessage(recipient, 'Broadcast message')
);
await Promise.all(messagePromises);

// Pagination example
let hasMore = true;
let cursor: string | undefined;
const allMessages: ConnectMessage[] = [];

while (hasMore) {
  const messages = await sdk.getMessages('user123', {
    limit: 100,
    before: cursor
  });
  
  allMessages.push(...messages);
  cursor = messages[messages.length - 1]?.id;
  hasMore = messages.length === 100;
}
```

## License

MIT

## Support

- Documentation: https://docs.connectplatform.com
- GitHub Issues: https://github.com/ring-platform/connect-sdk/issues
- Discord: https://discord.gg/connectplatform 