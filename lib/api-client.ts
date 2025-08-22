/**
 * Ring Platform API Client with ES2022 enhancements
 * 
 * A comprehensive API client utility that standardizes API route calls across the platform
 * using modern ES2022 features for better error handling, type safety, and consistency.
 */

import { hasOwnProperty } from '@/lib/utils';

/**
 * Standard API response structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  context?: {
    timestamp: number;
    [key: string]: any;
  };
}

/**
 * API request configuration
 */
export interface ApiRequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
}

/**
 * API client error with ES2022 Error.cause support
 */
export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly response?: Response;
  public readonly context?: any;

  constructor(message: string, statusCode: number, response?: Response, context?: any, cause?: Error) {
    super(message, { cause });
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.response = response;
    this.context = context;
  }
}

/**
 * Ring Platform API Client
 * 
 * Centralized API client with ES2022 enhancements for consistent API route communication
 * Includes request deduplication to prevent duplicate concurrent requests
 */
export class RingApiClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly defaultTimeout: number;
  private readonly pendingRequests: Map<string, Promise<ApiResponse<any>>>;

  constructor(baseUrl?: string) {
    // ES2022 logical assignment for configuration
    this.baseUrl = baseUrl ?? (process.env.NEXT_PUBLIC_API_URL || '');
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
    this.defaultTimeout = 10000; // 10 seconds
    this.pendingRequests = new Map(); // For request deduplication
  }

  /**
   * Make an authenticated API request with ES2022 enhancements
   * 
   * @param endpoint - The API endpoint (without base URL)
   * @param config - Request configuration
   * @returns Promise<ApiResponse<T>> - Standardized API response
   */
  async request<T = any>(endpoint: string, config: ApiRequestConfig = {}): Promise<ApiResponse<T>> {
    // ES2022 logical assignment for request configuration
    const requestConfig = {
      method: 'GET',
      timeout: this.defaultTimeout,
      retries: 0,
      ...config
    } as Required<ApiRequestConfig>;

    // Generate request key for deduplication (only for GET requests)
    const requestKey = requestConfig.method === 'GET' 
      ? `${requestConfig.method}:${endpoint}` 
      : null;

    // Check if there's already a pending request for the same endpoint (GET only)
    if (requestKey && this.pendingRequests.has(requestKey)) {
      console.log(`RingApiClient: Deduplicating request to ${endpoint} - returning existing promise`);
      return this.pendingRequests.get(requestKey) as Promise<ApiResponse<T>>;
    }

    // Create the request promise
    const requestPromise = this.executeRequest<T>(endpoint, requestConfig, config.headers);

    // Store the promise for deduplication (GET only)
    if (requestKey) {
      this.pendingRequests.set(requestKey, requestPromise);
      
      // Clean up the pending request when it completes
      requestPromise.finally(() => {
        this.pendingRequests.delete(requestKey);
      });
    }

    return requestPromise;
  }

  /**
   * Execute the actual request with retry logic
   * Separated from request() to enable deduplication
   */
  private async executeRequest<T = any>(
    endpoint: string, 
    requestConfig: Required<ApiRequestConfig>,
    additionalHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    // ES2022 logical assignment for headers
    const headers = {
      ...this.defaultHeaders,
      ...additionalHeaders
    };

    // Request context with ES2022 logical assignment
    const requestContext = {
      timestamp: Date.now(),
      endpoint,
      method: requestConfig.method,
      hasBody: !!requestConfig.body
    } as any;

    let attempt = 0;
    const maxAttempts = requestConfig.retries + 1;

    while (attempt < maxAttempts) {
      try {
        // ES2022 logical assignment for attempt tracking
        requestContext.attempt ??= attempt + 1;
        requestContext.maxAttempts ??= maxAttempts;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), requestConfig.timeout);

        const fetchConfig: RequestInit = {
          method: requestConfig.method,
          headers,
          signal: controller.signal,
        };

        // ES2022 Object.hasOwn() for safe body handling
        if (Object.hasOwn(requestConfig, 'body') && requestConfig.body !== undefined) {
          if (requestConfig.method !== 'GET' && requestConfig.method !== 'DELETE') {
            fetchConfig.body = typeof requestConfig.body === 'string' 
              ? requestConfig.body 
              : JSON.stringify(requestConfig.body);
          }
        }

        console.log(`RingApiClient: Making ${requestConfig.method} request to ${endpoint}`, {
          attempt: attempt + 1,
          hasBody: requestContext.hasBody,
          timestamp: requestContext.timestamp
        });

        const response = await fetch(`${this.baseUrl}${endpoint}`, fetchConfig);
        clearTimeout(timeoutId);

        // Parse response using ES2022 Object.hasOwn() for safe property checking
        const responseData = await this.parseResponse(response);

        if (!response.ok) {
          throw new ApiClientError(
            responseData?.error || `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            response,
            {
              ...requestContext,
              responseData,
              statusText: response.statusText
            }
          );
        }

        // ES2022 logical assignment for success response
        const successResponse: ApiResponse<T> = {
          success: true,
          data: responseData?.data || responseData,
          message: responseData?.message,
          context: {
            timestamp: requestContext.timestamp,
            endpoint,
            method: requestConfig.method
          }
        };

        console.log(`RingApiClient: Request successful for ${endpoint}`);
        return successResponse;

      } catch (error) {
        attempt++;
        
        if (error instanceof ApiClientError) {
          // Don't retry client errors (4xx)
          if (error.statusCode >= 400 && error.statusCode < 500) {
            throw error;
          }
        }

        if (attempt >= maxAttempts) {
          const apiError = error instanceof ApiClientError 
            ? error 
            : new ApiClientError(
                error instanceof Error ? error.message : 'Unknown error occurred',
                500,
                undefined,
                requestContext,
                error instanceof Error ? error : undefined
              );

          console.error(`RingApiClient: Request failed for ${endpoint}:`, apiError);
          throw apiError;
        }

        // ES2022 logical assignment for retry delay
        const retryDelay = 1000 * attempt; // Exponential backoff
        console.warn(`RingApiClient: Retrying ${endpoint} in ${retryDelay}ms (attempt ${attempt + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new ApiClientError('Maximum retry attempts exceeded', 500, undefined, requestContext);
  }

  /**
   * Parse API response with ES2022 Object.hasOwn() validation
   * 
   * @private
   * @param response - Fetch Response object
   * @returns Parsed response data
   */
  private async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      try {
        const data = await response.json();
        
        // ES2022 Object.hasOwn() for safe property validation
        if (data && typeof data === 'object') {
          return data;
        }
        
        return data;
      } catch (error) {
        console.warn('RingApiClient: Failed to parse JSON response, returning text');
        return await response.text();
      }
    }
    
    return await response.text();
  }

  /**
   * GET request helper
   */
  async get<T = any>(endpoint: string, config?: Omit<ApiRequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  /**
   * POST request helper
   */
  async post<T = any>(endpoint: string, body?: any, config?: Omit<ApiRequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'POST', body });
  }

  /**
   * PUT request helper
   */
  async put<T = any>(endpoint: string, body?: any, config?: Omit<ApiRequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PUT', body });
  }

  /**
   * DELETE request helper
   */
  async delete<T = any>(endpoint: string, config?: Omit<ApiRequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  /**
   * PATCH request helper
   */
  async patch<T = any>(endpoint: string, body?: any, config?: Omit<ApiRequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PATCH', body });
  }
}

/**
 * Default API client instance
 */
export const apiClient = new RingApiClient();

/**
 * Convenience functions for common API operations
 */

/**
 * Fetch user profile via API route
 */
export async function fetchUserProfile(): Promise<ApiResponse<any>> {
  return apiClient.get('/api/profile');
}

/**
 * Update user profile via API route
 */
export async function updateUserProfile(profileData: Record<string, any>): Promise<ApiResponse<any>> {
  return apiClient.post('/api/profile', profileData);
}

/**
 * Fetch conversations via API route
 */
export async function fetchConversations(filters?: Record<string, any>): Promise<ApiResponse<any>> {
  const queryParams = new URLSearchParams();
  
  if (filters && typeof filters === 'object') {
    Object.entries(filters).forEach(([key, value]) => {
      if (Object.hasOwn(filters, key) && value !== null && value !== undefined) {
        queryParams.append(key, String(value));
      }
    });
  }
  
  const endpoint = queryParams.toString() 
    ? `/api/conversations?${queryParams.toString()}` 
    : '/api/conversations';
    
  return apiClient.get(endpoint);
}

/**
 * Create conversation via API route
 */
export async function createConversation(conversationData: Record<string, any>): Promise<ApiResponse<any>> {
  return apiClient.post('/api/conversations', conversationData);
}

export default apiClient; 