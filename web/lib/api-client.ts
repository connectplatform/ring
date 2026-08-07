/**
 * Ring Platform API Client with ES2022 enhancements
 *
 * A comprehensive API client utility that standardizes API route calls across the platform
 * using modern ES2022 features for better error handling, type safety, and consistency.
 *
 * NOTE: Uses classic Fetch and delivers typed/hybrid error handling.
 * // TODO: Consider React 19's new use(POST), use(GET) primitives if API routes are used in Server Components.
 */

import { hasOwnProperty } from '@/lib/utils';

/**
 * Interface for cursor pagination used in list endpoints.
 */
export interface ApiPagination {
  hasMore: boolean;
  cursor?: string | null;
}

/**
 * Standardized API response structure for all endpoints.
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  pagination?: ApiPagination;
  metadata?: Record<string, unknown>;
  error?: string;
  message?: string;
  context?: {
    timestamp: number;
    [key: string]: any;
  };
}

/**
 * Extracts key payload fields in a safe, non-coercing manner from API JSON responses.
 * Returns an object containing the data, pagination, metadata, and message if present.
 */
function extractSuccessPayload<T>(
  responseData: unknown,
): Pick<ApiResponse<T>, 'data' | 'pagination' | 'metadata' | 'message'> {
  if (responseData === null || responseData === undefined) {
    // Handles nullish response case
    return { data: undefined };
  }

  if (typeof responseData !== 'object' || Array.isArray(responseData)) {
    // Handles primitive or array responses (should not normally happen)
    return { data: responseData as T };
  }

  const body = responseData as Record<string, unknown>;

  if (Object.hasOwn(body, 'data')) {
    // Returns only expected properties, avoiding falsy coercion
    return {
      data: body.data as T,
      pagination: body.pagination as ApiPagination | undefined,
      metadata: body.metadata as Record<string, unknown> | undefined,
      message: typeof body.message === 'string' ? body.message : undefined,
    };
  }

  // Handles case when body doesn't have 'data', possibly nonstandard API response
  return { data: responseData as T };
}

/**
 * Configuration object for API requests. All fields are optional.
 */
export interface ApiRequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
}

/**
 * Custom error class for API client, supporting ES2022 Error.cause.
 */
export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly response?: Response;
  public readonly context?: any;

  constructor(
    message: string,
    statusCode: number,
    response?: Response,
    context?: any,
    cause?: Error,
  ) {
    super(message, { cause });
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.response = response;
    this.context = context;
  }
}

/**
 * Resolve API base URL for RingApiClient.
 * Browser same-origin → always relative (`''`) so PORT / AUTH_URL drift cannot
 * cross-origin `/api/*` calls (Firefox NetworkError + missing session cookie).
 * Absolute NEXT_PUBLIC_API_URL is kept only when it points at a different host.
 */
export function resolveApiBaseUrl(explicit?: string): string {
  const fromEnv = (explicit ?? process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '')
  if (typeof window === 'undefined') {
    return fromEnv
  }
  if (!fromEnv) {
    return ''
  }
  try {
    const resolved = new URL(fromEnv, window.location.origin)
    if (resolved.origin === window.location.origin) {
      return ''
    }
    return fromEnv
  } catch {
    return ''
  }
}

/**
 * API client class centralizing access to platform APIs.
 * Handles deduplication for concurrent GETs, timeout, retries, and unified error reporting.
 */
export class RingApiClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly defaultTimeout: number;
  private readonly pendingRequests: Map<string, Promise<ApiResponse<any>>>;

  constructor(baseUrl?: string) {
    this.baseUrl = resolveApiBaseUrl(baseUrl);
    // JSON headers by default.
    this.defaultHeaders = { 'Content-Type': 'application/json' };
    // Default request timeout (ms)
    this.defaultTimeout = 10000;
    // Tracks in-flight GETs for deduplication.
    this.pendingRequests = new Map();
    // TODO: If using Next.js 16 Server Actions, consider using cache={auto} at the fetch-level for deduplication.
  }

  /**
   * Entrypoint for making an API request.
   * Handles deduplication for GETs and passes down to the request executor.
   * @param endpoint - Path (not including base URL).
   * @param config - ApiRequestConfig (method, headers, body, etc).
   */
  async request<T = any>(
    endpoint: string,
    config: ApiRequestConfig = {},
  ): Promise<ApiResponse<T>> {
    // Config with defaults; logical assignment (ES2022).
    const requestConfig = {
      method: 'GET',
      timeout: this.defaultTimeout,
      retries: 0,
      ...config,
    } as Required<ApiRequestConfig>;

    // Compose deduplication key for concurrent GET requests.
    const requestKey =
      requestConfig.method === 'GET' ? `${requestConfig.method}:${endpoint}` : null;

    if (requestKey && this.pendingRequests.has(requestKey)) {
      // Return existing promise to deduplicate concurrent GET requests.
      console.log(`RingApiClient: Deduplicating request to ${endpoint} - returning existing promise`);
      return this.pendingRequests.get(requestKey) as Promise<ApiResponse<T>>;
    }

    // Actually invoke fetch + retry execution.
    const requestPromise = this.executeRequest<T>(
      endpoint,
      requestConfig,
      config.headers,
    );

    // Cache in pendingRequests map (only for GETs), clear out after complete.
    if (requestKey) {
      this.pendingRequests.set(requestKey, requestPromise);
      requestPromise.finally(() => {
        this.pendingRequests.delete(requestKey);
      });
    }

    return requestPromise;
  }

  /**
   * Executes an HTTP request with retry logic (built-in exponential backoff).
   * Handles request context tracking and proper cleanup of timeout signals.
   */
  private async executeRequest<T = any>(
    endpoint: string,
    requestConfig: Required<ApiRequestConfig>,
    additionalHeaders?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    // Merge headers from default and per-request.
    const headers = {
      ...this.defaultHeaders,
      ...additionalHeaders,
    };

    // Context for logging/debugging info available on errors.
    const requestContext = {
      timestamp: Date.now(),
      endpoint,
      method: requestConfig.method,
      hasBody: !!requestConfig.body,
    } as any;

    let attempt = 0;
    // Maximum number of attempts is (retries + 1).
    const maxAttempts = requestConfig.retries + 1;

    while (attempt < maxAttempts) {
      try {
        // First invocation: assign attempt/total attempts
        requestContext.attempt ??= attempt + 1;
        requestContext.maxAttempts ??= maxAttempts;

        // Set up abort signal for timeout.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), requestConfig.timeout);

        const fetchConfig: RequestInit = {
          method: requestConfig.method,
          headers,
          signal: controller.signal,
          // Required when NEXT_PUBLIC_API_URL is absolute (incl. same host different port).
          credentials: 'include',
        };

        // Only set body on non-GET and non-DELETE requests.
        // Use JSON.stringify if not already a string.
        if (
          Object.hasOwn(requestConfig, 'body') &&
          requestConfig.body !== undefined
        ) {
          if (
            requestConfig.method !== 'GET' &&
            requestConfig.method !== 'DELETE'
          ) {
            fetchConfig.body =
              typeof requestConfig.body === 'string'
                ? requestConfig.body
                : JSON.stringify(requestConfig.body);
          }
        }

        // Log outgoing request for debugging.
        console.log(`RingApiClient: Making ${requestConfig.method} request to ${endpoint}`, {
          attempt: attempt + 1,
          hasBody: requestContext.hasBody,
          timestamp: requestContext.timestamp,
        });

        // Actually make the request.
        const response = await fetch(`${this.baseUrl}${endpoint}`, fetchConfig);
        clearTimeout(timeoutId);

        // Parse JSON or fallback to text if parsing fails.
        const responseData = await this.parseResponse(response);

        if (!response.ok) {
          // Throw with error field if available, else generic status message.
          throw new ApiClientError(
            responseData?.error || `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            response,
            {
              ...requestContext,
              responseData,
              statusText: response.statusText,
            },
          );
        }

        // Unwrap payload for caller.
        const extracted = extractSuccessPayload<T>(responseData);

        const successResponse: ApiResponse<T> = {
          success: true,
          data: extracted.data,
          pagination: extracted.pagination,
          metadata: extracted.metadata,
          message: extracted.message,
          context: {
            timestamp: requestContext.timestamp,
            endpoint,
            method: requestConfig.method,
          },
        };

        console.log(`RingApiClient: Request successful for ${endpoint}`);
        return successResponse;
      } catch (error) {
        attempt++;

        if (error instanceof ApiClientError) {
          // Do not retry for HTTP 4xx errors (client-side)
          if (error.statusCode >= 400 && error.statusCode < 500) {
            throw error;
          }
        }

        if (attempt >= maxAttempts) {
          // All attempts exhausted; throw error contextualized for downstream
          const apiError =
            error instanceof ApiClientError
              ? error
              : new ApiClientError(
                  error instanceof Error
                    ? error.message
                    : 'Unknown error occurred',
                  500,
                  undefined,
                  requestContext,
                  error instanceof Error ? error : undefined,
                );

          console.error(`RingApiClient: Request failed for ${endpoint}:`, apiError);
          throw apiError;
        }

        // Exponential backoff before retrying
        const retryDelay = 1000 * attempt;
        console.warn(
          `RingApiClient: Retrying ${endpoint} in ${retryDelay}ms (attempt ${attempt + 1}/${maxAttempts})`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    // Should not ever be reached; safety for type inference.
    throw new ApiClientError(
      'Maximum retry attempts exceeded',
      500,
      undefined,
      requestContext,
    );
  }

  /**
   * Safely parses Fetch API responses.
   * Will attempt to JSON-parse if content-type indicates JSON,
   * fallback to text content if not JSON or parse error occurs.
   * @param response - native Fetch Response object
   */
  private async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      try {
        const data = await response.json();

        // Defensive type check (paranoid mode: should always be object if server OK)
        if (data && typeof data === 'object') {
          return data;
        }

        return data;
      } catch (error) {
        // Warn and fall back to text if JSON parse fails (malformed/misclassified).
        console.warn('RingApiClient: Failed to parse JSON response, returning text');
        return await response.text();
      }
    }

    // Not JSON: fallback to plain text
    return await response.text();
  }

  /**
   * Shorthand for GET requests.
   * @param endpoint - Resource route.
   * @param config - Additional request config (sans method).
   */
  async get<T = any>(
    endpoint: string,
    config?: Omit<ApiRequestConfig, 'method'>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  /**
   * Shorthand for POST requests.
   */
  async post<T = any>(
    endpoint: string,
    body?: any,
    config?: Omit<ApiRequestConfig, 'method' | 'body'>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'POST', body });
  }

  /**
   * Shorthand for PUT requests.
   */
  async put<T = any>(
    endpoint: string,
    body?: any,
    config?: Omit<ApiRequestConfig, 'method' | 'body'>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PUT', body });
  }

  /**
   * Shorthand for DELETE requests.
   */
  async delete<T = any>(
    endpoint: string,
    config?: Omit<ApiRequestConfig, 'method'>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  /**
   * Shorthand for PATCH requests.
   */
  async patch<T = any>(
    endpoint: string,
    body?: any,
    config?: Omit<ApiRequestConfig, 'method' | 'body'>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PATCH', body });
  }

  // TODO: If server-only, with Next.js 16 and React 19, consider Server Actions for mutations—
  //       and use the new fetch deduplication primitives.
}

/**
 * Default instance for general use (singleton export).
 */
export const apiClient = new RingApiClient();

/**
 * --- Convenience wrappers for individual API operations ---
 * (These may be called anywhere in the app—
 * but if you use Next.js server components, consider using Server Actions instead.)
 */

/**
 * Gets the current user profile from the API.
 */
export async function fetchUserProfile(): Promise<ApiResponse<any>> {
  return apiClient.get('/api/profile');
}

/**
 * Updates the user profile via POST to the API.
 * @param profileData - Object to post.
 */
export async function updateUserProfile(
  profileData: Record<string, any>,
): Promise<ApiResponse<any>> {
  return apiClient.post('/api/profile', profileData);
}

/**
 * Gets a paginated list of conversations.
 * Optionally accepts filter params (converted to query string).
 */
export async function fetchConversations(
  filters?: Record<string, any>,
): Promise<ApiResponse<any>> {
  const queryParams = new URLSearchParams();

  if (filters && typeof filters === 'object') {
    Object.entries(filters).forEach(([key, value]) => {
      // Only append keys that belong to filters and are not null/undefined.
      if (
        Object.hasOwn(filters, key) &&
        value !== null &&
        value !== undefined
      ) {
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
 * Creates a conversation via POST to API. 
 * @param conversationData - Initial conversation data.
 */
export async function createConversation(
  conversationData: Record<string, any>,
): Promise<ApiResponse<any>> {
  return apiClient.post('/api/conversations', conversationData);
}

export default apiClient;