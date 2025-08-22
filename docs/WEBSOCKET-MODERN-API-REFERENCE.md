# Modern WebSocket API Reference

## Quick Start

```typescript
import { useWebSocket } from '@/hooks/use-websocket'

const ws = useWebSocket()
```

## Available Hooks

### `useWebSocket()` - All-in-one hook
Returns connection + notifications + presence + system features
```typescript
const ws = useWebSocket()
// ws.isConnected, ws.notifications, ws.presence, ws.system
```

### `useWebSocket()` - Core connection
```typescript
const { isConnected, send, disconnect, reconnect } = useWebSocket()
```

### `useWebSocketNotifications()` - Push notifications  
```typescript
const { notifications, unreadCount, markAsRead } = useWebSocketNotifications()
```

### `useWebSocketMessages()` - Chat functionality
```typescript
const { messages, sendMessage, typingUsers } = useWebSocketMessages(conversationId)
```

### `useWebSocketPresence()` - Online status
```typescript
const { onlineUsers, onlineCount, isUserOnline } = useWebSocketPresence()
```

### `useWebSocketSystem()` - System events
```typescript
const { maintenanceMode, connectionQuality } = useWebSocketSystem()
```

## Common Patterns

### Basic Connection Check
```typescript
if (!ws.isConnected) {
  return <div>Connecting...</div>
}
```

### Send Custom Events
```typescript
const handleAction = () => {
  ws.send('custom_event', { data: 'hello' })
}
```

### Handle Notifications
```typescript
useEffect(() => {
  if (ws.notifications.lastNotification) {
    toast({
      title: ws.notifications.lastNotification.title,
      description: ws.notifications.lastNotification.body
    })
  }
}, [ws.notifications.lastNotification])
```

### Chat Integration
```typescript
const { messages, sendMessage, startTyping, stopTyping } = useWebSocketMessages(conversationId)

const handleSend = (content: string) => {
  sendMessage({ content, type: 'text' })
}

const handleTyping = () => {
  startTyping()
  setTimeout(stopTyping, 3000) // Stop typing after 3s
}
```

## Migration Notes

### ✅ What to Use
- `useWebSocket()` for general purpose 
- Specialized hooks for specific features
- Modern `send()` method for events

### ❌ What NOT to Use  
- ~~`wsClient` object~~ (removed)
- ~~Legacy compatibility functions~~ (removed)
- ~~Provider hook directly~~ (deprecated)

## Import Paths
```typescript
// ✅ Modern (recommended)
import { useWebSocket } from '@/hooks/use-websocket'

// ✅ Also works
import { useWebSocket } from '@/hooks/use-websocket'

// ⚠️ Deprecated (will show warning)
import { useWebSocket } from '@/components/providers/websocket-provider'
```
