/**
 * Debounce — delays fn until after `wait` ms of no calls.
 * Uses closure to persist timerId between calls.
 */
export function debounce(fn, wait) {
  let timerId = null;
  return function (...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      fn.apply(this, args);
      timerId = null;
    }, wait);
  };
}

/**
 * Cancellable debounce — expose cancel() for component teardown.
 */
export function debounceCancellable(fn, wait) {
  let timerId = null;
  return {
    execute(...args) {
      clearTimeout(timerId);
      timerId = setTimeout(() => { fn.apply(this, args); timerId = null; }, wait);
    },
    cancel() {
      clearTimeout(timerId);
      timerId = null;
    },
  };
}
