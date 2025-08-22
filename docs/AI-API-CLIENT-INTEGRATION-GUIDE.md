# RingApiClient Integration Guide

## Overview

The RingApiClient (`lib/api-client.ts`) provides standardized API communication across the Ring Platform with built-in timeout handling, retry logic, and structured error handling. This guide covers the implementation patterns and best practices for using the API client.

## Implementation Status

### ✅ Completed Migrations (Phase 1 & 2)

**Hooks:**
- `useWalletBalance` - 15s timeout, 2 retries for blockchain operations
- `useNotifications` - 8s timeout, 1 retry for notification operations  
- `useMessages` - 10s timeout, 2 retries for messaging operations

**Server Actions:**
- Auth server actions (`app/_actions/auth.ts`) - 15s timeout, 1 retry for critical auth flows

### 🔄 Pending Migrations (Phase 3)

- Entity/opportunity fetching hooks
- Additional server actions
- Request deduplication implementation
- Performance monitoring dashboard

## Core Features

### 1. Standardized API Response Interface

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  context?: {
    timestamp: number;
    [key: string]: any;
  };
}
```

### 2. Structured Error Handling

```typescript
class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly response?: Response;
  public readonly context?: any;
}
```

### 3. Domain-Specific Timeout Configurations

| Domain | Timeout | Retries | Use Case |
|--------|---------|---------|----------|
| Wallet | 15s | 2 | Blockchain operations |
| Auth | 15s | 1 | Critical authentication |
| Messaging | 10s | 2 | Message sending/loading |
| Notifications | 8s | 1 | Notification operations |

## Usage Patterns

### Client-Side Hooks

```typescript
import { apiClient, ApiClientError, type ApiResponse } from '@/lib/api-client'

// Example: useWalletBalance hook
const fetchBalance = async () => {
  try {
    const response: ApiResponse<WalletBalanceResponse> = await apiClient.get('/api/wallet/balance', {
      timeout: 15000, // 15 second timeout for blockchain calls
      retries: 2 // Retry twice for network resilience
    })

    if (response.success && response.data) {
      setBalance(response.data.balance)
    } else {
      throw new Error(response.error || 'Failed to fetch balance')
    }
  } catch (err) {
    if (err instanceof ApiClientError) {
      // Enhanced error information from API client
      setError(err.message)
      setStatusCode(err.statusCode)
      setContext(err.context)
      
      // Log with structured context
      console.error('Wallet balance fetch failed:', {
        endpoint: '/api/wallet/balance',
        statusCode: err.statusCode,
        message: err.message,
        context: err.context,
        cause: err.cause
      })
    } else {
      setError(err instanceof Error ? err.message : 'Failed to fetch balance')
    }
  }
}
```

### Server Actions

```typescript
// Example: Auth server action
const response: ApiResponse = await apiClient.post(`${process.env.NEXTAUTH_URL}/api/auth/signin/credentials`, {
  email: email.trim(),
  password,
  redirectTo,
}, {
  timeout: 15000, // 15 second timeout for auth operations
  retries: 1 // Retry once for critical auth flow
})

if (response.success) {
  redirect(redirectTo)
} else {
  return { error: response.error || 'Invalid email or password' }
}
```

## Error Handling Best Practices

### 1. Structured Error Logging

```typescript
if (err instanceof ApiClientError) {
  console.error('API call failed:', {
    endpoint: '/api/endpoint',
    statusCode: err.statusCode,
    message: err.message,
    context: err.context,
    cause: err.cause
  })
}
```

### 2. User-Friendly Error Messages

```typescript
if (error instanceof ApiClientError) {
  // Return user-friendly error based on status code
  if (error.statusCode === 401 || error.statusCode === 403) {
    return { error: 'Invalid email or password' }
  } else if (error.statusCode === 429) {
    return { error: 'Too many login attempts. Please try again later.' }
  } else {
    return { error: 'Authentication service unavailable. Please try again.' }
  }
}
```

### 3. Domain-Specific Error Handling

```typescript
// Wallet operations
if (error.statusCode === 404) {
  return { error: 'Wallet not found. Please check your configuration.' }
}

// Messaging operations  
if (error.statusCode === 403) {
  return { error: 'You do not have permission to send messages in this conversation.' }
}

// Notification operations
if (error.statusCode === 429) {
  return { error: 'Too many notification requests. Please wait before trying again.' }
}
```

## Migration Checklist

### For New Hooks

1. **Import API Client**
   ```typescript
   import { apiClient, ApiClientError, type ApiResponse } from '@/lib/api-client'
   ```

2. **Replace fetch() with apiClient**
   ```typescript
   // Before
   const response = await fetch('/api/endpoint')
   
   // After
   const response: ApiResponse<T> = await apiClient.get('/api/endpoint', {
     timeout: 8000,
     retries: 1
   })
   ```

3. **Update Error Handling**
   ```typescript
   // Before
   if (!response.ok) {
     throw new Error(`HTTP error! status: ${response.status}`)
   }
   
   // After
   if (response.success && response.data) {
     // Handle success
   } else {
     throw new Error(response.error || 'Operation failed')
   }
   ```

4. **Add Structured Logging**
   ```typescript
   if (err instanceof ApiClientError) {
     console.error('Operation failed:', {
       endpoint: '/api/endpoint',
       statusCode: err.statusCode,
       context: err.context
     })
   }
   ```

### For Server Actions

1. **Import API Client**
   ```typescript
   import { apiClient, ApiClientError, type ApiResponse } from '@/lib/api-client'
   ```

2. **Replace fetch() with apiClient**
   ```typescript
   // Before
   const response = await fetch(`${process.env.NEXTAUTH_URL}/api/endpoint`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(data)
   })
   
   // After
   const response: ApiResponse = await apiClient.post(`${process.env.NEXTAUTH_URL}/api/endpoint`, data, {
     timeout: 15000,
     retries: 1
   })
   ```

3. **Update Response Handling**
   ```typescript
   // Before
   if (!response.ok) {
     const errorData = await response.json().catch(() => ({}))
     return { error: errorData.message || 'Operation failed' }
   }
   
   // After
   if (response.success) {
     return { success: true, message: response.message }
   } else {
     return { error: response.error || 'Operation failed' }
   }
   ```

## Performance Benefits

### Before API Client Integration
- **84+ individual fetch() calls** scattered across components
- **No timeout protection** for critical operations
- **Inconsistent error handling** patterns
- **No retry logic** for network failures
- **Mixed response parsing** logic

### After API Client Integration
- **Standardized API communication** across all hooks
- **Domain-specific timeout protection** (8s-15s)
- **Automatic retry logic** (1-2 retries)
- **Structured error handling** with ApiClientError
- **Consistent response format** with ApiResponse<T>
- **Enhanced debugging** with structured logging

## Monitoring and Observability

### Error Tracking
- All API errors are logged with structured context
- Status codes and error messages are captured
- Request context includes endpoint, timestamp, and parameters

### Performance Metrics
- Request timeouts are tracked and logged
- Retry attempts are monitored
- Success/failure rates can be measured

### Debugging Support
- Detailed error context for troubleshooting
- Request/response logging for development
- Structured error messages for user feedback

## Future Enhancements (Phase 3)

### Request Deduplication
- Prevent duplicate API calls for same endpoint
- Cache responses for improved performance
- Implement request queuing for high-frequency operations

### Performance Dashboard
- Real-time API metrics monitoring
- Error rate tracking and alerting
- Performance optimization recommendations

### Advanced Caching
- Intelligent cache invalidation
- Background refresh for stale data
- Optimistic updates for better UX

## Compliance and Standards

### Code Quality
- All API calls must use RingApiClient
- Error handling must follow structured patterns
- Timeout configurations must be domain-appropriate

### Security
- Sensitive data is not logged in error context
- Authentication tokens are handled securely
- Rate limiting is respected through retry logic

### Performance
- Timeout values are optimized per domain
- Retry logic prevents unnecessary load
- Error handling doesn't impact user experience

## Related Documentation

- [API Client Implementation](./api-client.ts)
- [WebSocket Integration Guide](./WEBSOCKET-OPTIMIZATION-GUIDE.md)
- [System Architecture](./SYSTEM-ARCHITECTURE.md)
- [Platform Philosophy](./PLATFORM-PHILOSOPHY.md)
