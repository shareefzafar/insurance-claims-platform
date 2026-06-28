/**
 * Promise Utilities — Unit Tests
 * ================================
 * Tests: retry with exponential backoff, timeout, safeAsync, parallel fetch.
 */

import { retry, withTimeout, safeAsync, sleep } from '@/utils/promiseUtils';

jest.useFakeTimers();

// Helper to make timers advance with async operations
const flushPromises = (): Promise<void> =>
  new Promise(resolve => setImmediate(resolve));

describe('retry()', () => {

  test('returns result immediately on first success', async () => {
    const fn = jest.fn().mockResolvedValue('success');

    const promise = retry(fn, { maxAttempts: 3 });
    await flushPromises();
    jest.runAllTimers();
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('retries on failure and succeeds on second attempt', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValue('success on retry');

    const promise = retry(fn, { maxAttempts: 3, baseDelayMs: 100 });
    await flushPromises();
    jest.advanceTimersByTime(100); // advance past backoff delay
    await flushPromises();
    const result = await promise;

    expect(result).toBe('success on retry');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('throws last error after all attempts exhausted', async () => {
    const error = new Error('Persistent failure');
    const fn = jest.fn().mockRejectedValue(error);

    const promise = retry(fn, { maxAttempts: 3, baseDelayMs: 100 });
    await flushPromises();
    jest.advanceTimersByTime(100);
    await flushPromises();
    jest.advanceTimersByTime(200);
    await flushPromises();

    await expect(promise).rejects.toThrow('Persistent failure');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('does not retry when isRetryable returns false', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Not retryable'));

    await expect(
      retry(fn, {
        maxAttempts:  3,
        isRetryable:  () => false, // never retry
      })
    ).rejects.toThrow('Not retryable');

    expect(fn).toHaveBeenCalledTimes(1); // no retries
  });

  test('calls onRetry callback on each retry', async () => {
    const onRetry = jest.fn();
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const promise = retry(fn, { maxAttempts: 3, baseDelayMs: 100, onRetry });
    await flushPromises();
    jest.advanceTimersByTime(100);
    await flushPromises();
    jest.advanceTimersByTime(200);
    await flushPromises();
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error));
  });

  test('uses exponential backoff between retries', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const onRetry = jest.fn();
    const promise = retry(fn, { maxAttempts: 3, baseDelayMs: 100, onRetry });

    await flushPromises(); // attempt 1 fails
    // Attempt 2 delay: 100ms * 2^0 = 100ms
    jest.advanceTimersByTime(99);
    await flushPromises();
    expect(fn).toHaveBeenCalledTimes(1); // not yet

    jest.advanceTimersByTime(1);         // now at 100ms
    await flushPromises();
    expect(fn).toHaveBeenCalledTimes(2); // attempt 2

    // Attempt 3 delay: 100ms * 2^1 = 200ms
    jest.advanceTimersByTime(200);
    await flushPromises();
    await promise;
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('withTimeout()', () => {

  test('resolves when promise completes before timeout', async () => {
    const promise = withTimeout(Promise.resolve('fast'), 1000);
    jest.advanceTimersByTime(0);
    await expect(promise).resolves.toBe('fast');
  });

  test('rejects with timeout error when promise exceeds limit', async () => {
    const slowPromise = new Promise<string>(resolve =>
      setTimeout(() => resolve('slow'), 2000)
    );
    const promise = withTimeout(slowPromise, 1000);
    jest.advanceTimersByTime(1000);
    await expect(promise).rejects.toThrow('timed out after 1000ms');
  });
});

describe('safeAsync()', () => {

  test('returns success result with data', async () => {
    const result = await safeAsync(async () => 'value');
    expect(result).toEqual({ success: true, data: 'value' });
  });

  test('returns failure result with error message', async () => {
    const result = await safeAsync(async () => {
      throw new Error('Something went wrong');
    });
    expect(result).toEqual({ success: false, error: 'Something went wrong' });
  });

  test('handles non-Error throws', async () => {
    const result = await safeAsync(async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'string error'; // not an Error instance
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Unknown error occurred');
    }
  });

  test('caller must check result.success — discriminated union forces it', async () => {
    const result = await safeAsync(async () => 42);

    // TypeScript: accessing result.data directly would error — must check first
    if (result.success) {
      // Inside here: TypeScript knows result.data is number
      expect(result.data).toBe(42);
    }
  });
});
