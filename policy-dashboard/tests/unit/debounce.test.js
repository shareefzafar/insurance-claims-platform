import { jest } from '@jest/globals';
import { debounce, debounceCancellable } from '../../src/utils/debounce.js';

jest.useFakeTimers();

describe('debounce()', () => {

  afterEach(() => jest.clearAllTimers());

  test('does NOT call fn immediately', () => {
    const fn = jest.fn();
    debounce(fn, 300)();
    expect(fn).not.toHaveBeenCalled();
  });

  test('calls fn after the wait period expires', () => {
    const fn = jest.fn();
    debounce(fn, 300)();
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('cancels previous call when called again within wait period', () => {
    const fn        = jest.fn();
    const debounced = debounce(fn, 300);
    debounced();
    jest.advanceTimersByTime(100);
    debounced();
    jest.advanceTimersByTime(100);
    debounced();
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('forwards all arguments to the wrapped function', () => {
    const fn        = jest.fn();
    const debounced = debounce(fn, 300);
    debounced('POL-001', 42, { key: 'value' });
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledWith('POL-001', 42, { key: 'value' });
  });

  test('can fire again after wait period expires', () => {
    const fn        = jest.fn();
    const debounced = debounce(fn, 300);
    debounced();
    jest.advanceTimersByTime(300);
    debounced();
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('debounceCancellable()', () => {

  afterEach(() => jest.clearAllTimers());

  test('execute() works like debounce', () => {
    const fn          = jest.fn();
    const { execute } = debounceCancellable(fn, 300);
    execute(); execute();
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('cancel() prevents the pending call from firing', () => {
    const fn              = jest.fn();
    const { execute, cancel } = debounceCancellable(fn, 300);
    execute();
    jest.advanceTimersByTime(100);
    cancel();
    jest.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled();
  });

  test('cancel() is safe to call when nothing is pending', () => {
    const { cancel } = debounceCancellable(jest.fn(), 300);
    expect(() => cancel()).not.toThrow();
  });
});
