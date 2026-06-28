/**
 * Debounce Utility — Unit Tests
 * ==============================
 * Tests: closure behaviour, timer cancellation, generic types,
 *        throttle, cancellable debounce.
 */

import { debounce, throttle, debounceCancellable } from '@/utils/debounce';

// Jest replaces real timers with controllable fakes
jest.useFakeTimers();

describe('debounce()', () => {

  afterEach(() => {
    jest.clearAllTimers();
  });

  test('does not call fn immediately', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced();

    expect(fn).not.toHaveBeenCalled();
  });

  test('calls fn after the wait period', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced();
    jest.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('cancels previous call when invoked again within wait period', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced();             // call 1 — should be cancelled
    jest.advanceTimersByTime(100);
    debounced();             // call 2 — resets timer
    jest.advanceTimersByTime(100);
    debounced();             // call 3 — resets timer again
    jest.advanceTimersByTime(300); // only call 3 fires

    expect(fn).toHaveBeenCalledTimes(1);
    // This is the core debounce behaviour — only the LAST call fires
  });

  test('forwards all arguments to the wrapped function', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced('hello', 42, { key: 'value' });
    jest.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledWith('hello', 42, { key: 'value' });
  });

  test('can be called again after wait period expires', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced();
    jest.advanceTimersByTime(300); // first call fires

    debounced();
    jest.advanceTimersByTime(300); // second call fires

    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('works with generic typed functions', () => {
    // TypeScript ensures the debounced function has the same signature
    const searchFn = jest.fn((query: string, limit: number): void => {
      void query; void limit;
    });
    const debouncedSearch = debounce(searchFn, 300);

    // TypeScript would error if we passed wrong types: debouncedSearch(123, 'wrong')
    debouncedSearch('policy-001', 10);
    jest.advanceTimersByTime(300);

    expect(searchFn).toHaveBeenCalledWith('policy-001', 10);
  });
});

describe('throttle()', () => {

  afterEach(() => {
    jest.clearAllTimers();
  });

  test('calls fn immediately on first call', () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 300);

    throttled();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('ignores calls within the limit window', () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 300);

    throttled(); // fires immediately
    jest.advanceTimersByTime(100);
    throttled(); // ignored — within 300ms limit
    jest.advanceTimersByTime(100);
    throttled(); // ignored

    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('allows call after limit window expires', () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 300);

    throttled(); // fires: call 1
    jest.advanceTimersByTime(300);
    throttled(); // fires: call 2 — 300ms has passed

    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('debounce fires LAST call; throttle fires FIRST call', () => {
    const debounced = jest.fn();
    const throttled = jest.fn();

    const debouncedFn = debounce(debounced, 300);
    const throttledFn = throttle(throttled, 300);

    // Rapid fire 5 times
    for (let i = 0; i < 5; i++) {
      debouncedFn();
      throttledFn();
      jest.advanceTimersByTime(50);
    }
    jest.advanceTimersByTime(300);

    expect(debounced).toHaveBeenCalledTimes(1); // debounce: only last
    expect(throttled).toHaveBeenCalledTimes(1); // throttle: only first in window
  });
});

describe('debounceCancellable()', () => {

  afterEach(() => {
    jest.clearAllTimers();
  });

  test('execute() behaves like debounce', () => {
    const fn = jest.fn();
    const { execute } = debounceCancellable(fn, 300);

    execute();
    execute(); // cancels first
    jest.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('cancel() prevents the pending call from firing', () => {
    const fn = jest.fn();
    const { execute, cancel } = debounceCancellable(fn, 300);

    execute();
    jest.advanceTimersByTime(100);
    cancel(); // cancel before 300ms
    jest.advanceTimersByTime(300);

    expect(fn).not.toHaveBeenCalled();
    // Use case: component unmounts — cancel pending search to avoid setState on unmounted component
  });

  test('cancel() is safe to call when nothing is pending', () => {
    const fn = jest.fn();
    const { cancel } = debounceCancellable(fn, 300);

    expect(() => cancel()).not.toThrow();
  });
});
