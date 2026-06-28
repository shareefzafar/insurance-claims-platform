/**
 * API Client — Generic typed HTTP client
 * ========================================
 * Demonstrates: generics, async/await typing, error handling,
 *               discriminated unions (Result type), retry pattern.
 *
 * The generic parameter T flows through fetch → json() → return type.
 * Caller gets the correct type without any casting.
 */

import { retry, withTimeout, safeAsync } from '@/utils/promiseUtils';
import type { ApiResponse, Page } from '@/types/policy.types';

// ─────────────────────────────────────────────────────────────────────────────
// HTTP ERROR TYPE
// ─────────────────────────────────────────────────────────────────────────────

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly body?: unknown
  ) {
    super(`HTTP ${statusCode}: ${message}`);
    this.name = 'HttpError';
  }

  get isNotFound():       boolean { return this.statusCode === 404; }
  get isUnauthorized():   boolean { return this.statusCode === 401; }
  get isForbidden():      boolean { return this.statusCode === 403; }
  get isServerError():    boolean { return this.statusCode >= 500; }
  get isRetryable():      boolean { return this.statusCode === 503 || this.statusCode === 429; }
}

// ─────────────────────────────────────────────────────────────────────────────
// API CLIENT CONFIG
// ─────────────────────────────────────────────────────────────────────────────

interface ApiClientConfig {
  baseUrl:      string;
  timeoutMs?:   number;
  maxRetries?:  number;
  getAuthToken?: () => string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC API CLIENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ApiClient — type-safe HTTP client.
 *
 * Generic T flows through every method:
 *   client.get<Policy>('/policies/P001') → Promise<Policy>
 *   client.get<Page<Claim>>('/claims')   → Promise<Page<Claim>>
 *
 * No any types. No casting at the call site.
 */
export class ApiClient {
  private readonly config: Required<ApiClientConfig>;

  constructor(config: ApiClientConfig) {
    this.config = {
      baseUrl:      config.baseUrl,
      timeoutMs:    config.timeoutMs  ?? 10_000,
      maxRetries:   config.maxRetries ?? 3,
      getAuthToken: config.getAuthToken ?? (() => null),
    };
  }

  // ── CORE REQUEST METHOD ─────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const token = this.config.getAuthToken();

    const headers: Record<string, string> = {
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const fetchFn = async (): Promise<T> => {
      const response = await withTimeout(
        fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        }),
        this.config.timeoutMs
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new HttpError(response.status, response.statusText, errorBody);
      }

      // void responses (204 No Content)
      if (response.status === 204) return undefined as T;

      const json: ApiResponse<T> = await response.json();
      return json.data;
      // TypeScript knows: json.data is T — no casting needed
    };

    // Retry only on retryable errors (503, 429)
    return retry(fetchFn, {
      maxAttempts:  this.config.maxRetries,
      baseDelayMs:  100,
      isRetryable:  (err) => err instanceof HttpError && err.isRetryable,
      onRetry: (attempt, err) => {
        console.warn(`[ApiClient] Retry ${attempt} for ${method} ${url}:`, err);
      },
    });
  }

  // ── PUBLIC METHODS ──────────────────────────────────────────────────────

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON CLIENT INSTANCE
// ─────────────────────────────────────────────────────────────────────────────

export const apiClient = new ApiClient({
  baseUrl:      import.meta.env['VITE_API_BASE_URL'] as string ?? '/api/v1',
  timeoutMs:    10_000,
  maxRetries:   3,
  getAuthToken: () => sessionStorage.getItem('access_token'),
});
