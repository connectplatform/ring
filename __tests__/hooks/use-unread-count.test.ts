/**
 * Tests for useUnreadCount hook
 * Verifies caching, polling, and tab visibility functionality
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useUnreadCount } from '@/hooks/use-unread-count';
import { useSession } from 'next-auth/react';

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage
});

// Mock document visibility
Object.defineProperty(document, 'hidden', {
  writable: true,
  value: false
});

describe('useUnreadCount', () => {
  const mockSession = {
    user: { id: 'test-user' },
    expires: '2025-12-31'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({ data: mockSession });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ unreadCount: 5 })
    });
    document.hidden = false;
  });

  it('should fetch unread count on mount', async () => {
    const { result } = renderHook(() => useUnreadCount());

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(5);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/notifications?unreadOnly=true&limit=1&stats=true'
    );
  });

  it('should use cached data when available and not expired', async () => {
    const cachedData = { unreadCount: 3 };
    const cacheTime = Date.now() - 60000; // 1 minute ago (within 2-minute TTL)

    mockSessionStorage.getItem
      .mockReturnValueOnce(JSON.stringify(cachedData)) // cached data
      .mockReturnValueOnce(cacheTime.toString()); // cache time

    const { result } = renderHook(() => useUnreadCount());

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(3);
    });

    // Should not make API call when using cache
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should fetch fresh data when cache is expired', async () => {
    const cachedData = { unreadCount: 3 };
    const cacheTime = Date.now() - 180000; // 3 minutes ago (expired)

    mockSessionStorage.getItem
      .mockReturnValueOnce(JSON.stringify(cachedData)) // cached data
      .mockReturnValueOnce(cacheTime.toString()); // cache time

    const { result } = renderHook(() => useUnreadCount());

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(5);
    });

    // Should make API call when cache is expired
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should cache successful API responses', async () => {
    const { result } = renderHook(() => useUnreadCount());

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(5);
    });

    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'notifications-unread',
      JSON.stringify({ unreadCount: 5 })
    );
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'notifications-unread-time',
      expect.any(String)
    );
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUnreadCount());

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to fetch unread count');
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('should clear cache and refresh on manual refresh', async () => {
    const { result } = renderHook(() => useUnreadCount());

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(5);
    });

    // Clear previous calls
    jest.clearAllMocks();

    await act(async () => {
      await result.current.refresh();
    });

    // Should clear cache
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('notifications-unread');
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('notifications-unread-time');

    // Should fetch fresh data
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should not fetch when session is not available', () => {
    (useSession as jest.Mock).mockReturnValue({ data: null });

    renderHook(() => useUnreadCount());

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should handle tab visibility changes', async () => {
    const { result } = renderHook(() => useUnreadCount());

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(5);
    });

    // Clear previous calls
    jest.clearAllMocks();

    // Simulate tab becoming visible
    act(() => {
      document.hidden = true;
      document.dispatchEvent(new Event('visibilitychange'));
      document.hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('notifications-unread');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('notifications-unread-time');
    });
  });

  it('should respect custom options', async () => {
    const customOptions = {
      autoRefresh: false,
      refreshInterval: 300000, // 5 minutes
      cacheTimeout: 60000 // 1 minute
    };

    renderHook(() => useUnreadCount(customOptions));

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(5);
    });

    // Should still make initial fetch
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should clear error when clearError is called', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUnreadCount());

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to fetch unread count');
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});
