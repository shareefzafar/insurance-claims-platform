/**
 * JAVASCRIPT CORE CONCEPT: Promise Patterns
 * ===========================================
 * Demonstrates: Promise constructor, async/await, Promise.all,
 *               error handling, generators concept applied to async iteration.
 *
 * All functions are typed with TypeScript generics so return types are inferred.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPED SLEEP — building block for retry and timeout
// ─────────────────────────────────────────────────────────────────────────────

export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

// ─────────────────────────────────────────────────────────────────────────────
// RETRY WITH EXPONENTIAL BACKOFF
// ─────────────────────────────────────────────────────────────────────────────

export interface RetryOptions {
  maxAttempts:   number;
  baseDelayMs?:  number;   // default 100ms
  isRetryable?:  (error: unknown) => boolean; // default: always retry
  onRetry?:      (attempt: number, error: unknown) => void;
}

/**
 * Retry an async operation with exponential backoff.
 *
 * Generic <T> is inferred from fn return type — caller never needs to write retry<Policy>().
 *
 * EXPONENTIAL BACKOFF: delay = baseDelayMs * 2^(attempt-1)
 *   Attempt 1: 100ms
 *   Attempt 2: 200ms
 *   Attempt 3: 400ms
 *
 * isRetryable: caller decides which errors warrant a retry.
 *   404 Not Found: should NOT retry — resource does not exist.
 *   503 Service Unavailable: SHOULD retry — temporary outage.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, baseDelayMs = 100, isRetryable = () => true, onRetry } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(); // success — return immediately
    } catch (error: unknown) {
      lastError = error;

      // Non-retryable error — throw immediately, do not wait
      if (!isRetryable(error)) throw error;

      // Last attempt — no point waiting before throwing
      if (attempt === maxAttempts) break;

      onRetry?.(attempt, error); // notify caller of retry (optional)

      // Exponential backoff delay
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMEOUT WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Race a promise against a timeout.
 * Promise.race: first to settle wins.
 * Promise<never> from timer means it can never resolve (only reject) —
 * TypeScript infers the return type as T (absorbs never in the union).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timer = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timer]);
  // TypeScript knows: Promise.race([Promise<T>, Promise<never>]) returns Promise<T>
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPED PARALLEL FETCH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch policy and its claims SIMULTANEOUSLY.
 *
 * Sequential (SLOW):
 *   const policy = await fetchPolicy(id);   // waits 300ms
 *   const claims = await fetchClaims(id);   // then waits 200ms
 *   // Total: 500ms
 *
 * Parallel (FAST):
 *   const [policy, claims] = await fetchPolicyWithClaims(id);
 *   // Total: max(300ms, 200ms) = 300ms
 *
 * TypeScript preserves tuple types through destructuring:
 * [policy, claims] — policy typed as Policy, claims typed as Claim[]
 */
export async function fetchParallel<T extends readonly Promise<unknown>[]>(
  ...promises: T
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  return Promise.all(promises) as Promise<{ [K in keyof T]: Awaited<T[K]> }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT TYPE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps an async operation in a Result type.
 * Caller MUST handle both success and failure — discriminated union forces it.
 * No silent swallowing of errors. No try/catch at every call site.
 */
export async function safeAsync<T>(
  fn: () => Promise<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    return { success: false, error: message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC GENERATOR — lazy pagination (demonstrates generator concept)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Async generator for paginated API results.
 * Fetches one page at a time — never loads all data into memory.
 *
 * GENERATOR CONCEPT:
 *   yield pauses execution, gives a value to the caller.
 *   Caller calls .next() (or for-await-of) to get the next page.
 *   Stops when there are no more pages.
 *
 * Usage:
 *   for await (const page of fetchAllPages(fetchClaims, { size: 20 })) {
 *     displayBatch(page); // process 20 at a time, never 10,000 at once
 *   }
 */
export async function* fetchAllPages<T>(
  fetchFn: (page: number, size: number) => Promise<{ content: T[]; totalPages: number }>,
  options: { size?: number } = {}
): AsyncGenerator<T[], void, unknown> {
  const size = options.size ?? 20;
  let page = 0;
  let totalPages = 1; // will be updated after first fetch

  while (page < totalPages) {
    const result = await fetchFn(page, size);
    totalPages = result.totalPages;
    yield result.content; // pause here, give caller this page
    page++;
  }
}
