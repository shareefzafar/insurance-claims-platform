/**
 * JAVASCRIPT CORE CONCEPT: Debounce
 * ===================================
 * Demonstrates: closures, setTimeout/clearTimeout, this binding,
 *               function factories, generic TypeScript types.
 *
 * USE CASE: Policy search input — do not fire an API call on every keystroke.
 *           Wait until the user stops typing for `wait` milliseconds.
 *
 * EVENT LOOP EXPLANATION:
 *   Each keystroke calls the debounced function.
 *   clearTimeout(timerId) cancels the previous scheduled call.
 *   setTimeout schedules a new call after `wait` ms.
 *   Only the LAST call's timeout actually fires.
 *   timerId persists between calls via CLOSURE — not a global variable.
 */

/**
 * Generic debounce — T is inferred from the wrapped function.
 * debounce(searchFn, 300) returns a function with the same signature as searchFn.
 *
 * @param fn    The function to debounce
 * @param wait  Milliseconds to wait after the last call
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  // ^ timerId is in the CLOSURE — persists between calls to the returned function
  // ^ Without closure: timerId would be a new variable on every call — debounce impossible

  return function (this: unknown, ...args: Parameters<T>): void {
    // Cancel the previously scheduled call — the user is still typing
    if (timerId !== null) {
      clearTimeout(timerId);
    }

    // Schedule a new call after `wait` milliseconds of silence
    timerId = setTimeout(() => {
      fn.apply(this, args);
      // fn.apply(this, args): preserves the calling context and all arguments
      // Without apply: 'this' could be wrong if used as a method
      timerId = null;
    }, wait);
  };
}

/**
 * Throttle — companion to debounce.
 * Executes at MOST once per `limit` milliseconds regardless of how often called.
 * Use for: scroll events, resize handlers, mouse move — fire at controlled rate.
 *
 * DIFFERENCE FROM DEBOUNCE:
 *   Debounce:  fires AFTER quiet period — waits for user to stop (search input)
 *   Throttle:  fires AT MOST once per interval — controls firing rate (scroll)
 */
export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  // ^ also a closure — lastCall persists between invocations

  return function (this: unknown, ...args: Parameters<T>): void {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn.apply(this, args);
    }
    // If called within the limit window: silently ignored
  };
}

/**
 * Creates a debounced function that also exposes a cancel() method.
 * Useful when you need to cancel pending calls on component unmount.
 *
 * CLOSURE usage: both the returned function and cancel() share the same timerId.
 */
export function debounceCancellable<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  wait: number
): { execute: (...args: Parameters<T>) => void; cancel: () => void } {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const execute = function (this: unknown, ...args: Parameters<T>): void {
    if (timerId !== null) clearTimeout(timerId);
    timerId = setTimeout(() => {
      fn.apply(this, args);
      timerId = null;
    }, wait);
  };

  const cancel = (): void => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  return { execute, cancel };
}
