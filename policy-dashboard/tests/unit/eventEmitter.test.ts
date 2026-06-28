/**
 * TypedEventEmitter — Unit Tests
 * ================================
 * Tests: on/off/emit/once, type-safe events, closure behaviour,
 *        snapshot-before-iterate, isolated failure.
 */

import { TypedEventEmitter } from '@/utils/eventEmitter';

// Test event map — defined once, used in all tests
type TestEvents = {
  'greet':      [name: string];
  'calculate':  [a: number, b: number];
  'logout':     [];
};

describe('TypedEventEmitter', () => {

  let emitter: TypedEventEmitter<TestEvents>;

  beforeEach(() => {
    emitter = new TypedEventEmitter<TestEvents>();
  });

  // ── ON / EMIT ──────────────────────────────────────────────────────────────

  describe('on() and emit()', () => {

    test('listener is called when event is emitted', () => {
      const listener = jest.fn();
      emitter.on('greet', listener);
      emitter.emit('greet', 'Mohammad');
      expect(listener).toHaveBeenCalledWith('Mohammad');
    });

    test('listener receives all arguments', () => {
      const listener = jest.fn();
      emitter.on('calculate', listener);
      emitter.emit('calculate', 3, 7);
      expect(listener).toHaveBeenCalledWith(3, 7);
    });

    test('multiple listeners all fire for the same event', () => {
      const l1 = jest.fn();
      const l2 = jest.fn();
      const l3 = jest.fn();

      emitter.on('greet', l1).on('greet', l2).on('greet', l3);
      emitter.emit('greet', 'World');

      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
      expect(l3).toHaveBeenCalledTimes(1);
    });

    test('emit with no listeners does not throw', () => {
      expect(() => emitter.emit('logout')).not.toThrow();
    });

    test('listeners for different events do not cross-fire', () => {
      const greetListener     = jest.fn();
      const calculateListener = jest.fn();

      emitter.on('greet', greetListener);
      emitter.on('calculate', calculateListener);

      emitter.emit('greet', 'Test');

      expect(greetListener).toHaveBeenCalledTimes(1);
      expect(calculateListener).not.toHaveBeenCalled();
    });
  });

  // ── OFF ────────────────────────────────────────────────────────────────────

  describe('off()', () => {

    test('removes the specific listener', () => {
      const listener = jest.fn();
      emitter.on('greet', listener);
      emitter.off('greet', listener);
      emitter.emit('greet', 'Test');

      expect(listener).not.toHaveBeenCalled();
    });

    test('only removes the specified listener, not all listeners for the event', () => {
      const l1 = jest.fn();
      const l2 = jest.fn();

      emitter.on('greet', l1).on('greet', l2);
      emitter.off('greet', l1); // remove only l1

      emitter.emit('greet', 'Test');

      expect(l1).not.toHaveBeenCalled(); // removed
      expect(l2).toHaveBeenCalledTimes(1); // still registered
    });

    test('off() for non-existent listener does not throw', () => {
      const listener = jest.fn();
      expect(() => emitter.off('greet', listener)).not.toThrow();
    });
  });

  // ── ONCE ───────────────────────────────────────────────────────────────────

  describe('once()', () => {

    test('listener fires exactly one time', () => {
      const listener = jest.fn();
      emitter.once('greet', listener);

      emitter.emit('greet', 'First');
      emitter.emit('greet', 'Second');
      emitter.emit('greet', 'Third');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('First');
    });

    test('once() listener receives the correct arguments', () => {
      const listener = jest.fn();
      emitter.once('calculate', listener);
      emitter.emit('calculate', 5, 10);
      expect(listener).toHaveBeenCalledWith(5, 10);
    });

    test('once() listener does not interfere with on() listeners', () => {
      const onceListener = jest.fn();
      const onListener   = jest.fn();

      emitter.once('greet', onceListener);
      emitter.on('greet', onListener);

      emitter.emit('greet', 'Test');
      emitter.emit('greet', 'Test again');

      expect(onceListener).toHaveBeenCalledTimes(1); // fired once, removed
      expect(onListener).toHaveBeenCalledTimes(2);   // fires every time
    });
  });

  // ── CHAINING ───────────────────────────────────────────────────────────────

  describe('method chaining', () => {

    test('on() returns this — enables chaining', () => {
      const l1 = jest.fn();
      const l2 = jest.fn();

      emitter.on('greet', l1).on('logout', l2);
      emitter.emit('greet', 'Test');
      emitter.emit('logout');

      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
    });
  });

  // ── LISTENER COUNT ─────────────────────────────────────────────────────────

  describe('listenerCount()', () => {

    test('returns 0 when no listeners registered', () => {
      expect(emitter.listenerCount('greet')).toBe(0);
    });

    test('returns correct count after registrations', () => {
      emitter.on('greet', jest.fn()).on('greet', jest.fn()).on('greet', jest.fn());
      expect(emitter.listenerCount('greet')).toBe(3);
    });

    test('decrements after off()', () => {
      const l = jest.fn();
      emitter.on('greet', l);
      expect(emitter.listenerCount('greet')).toBe(1);
      emitter.off('greet', l);
      expect(emitter.listenerCount('greet')).toBe(0);
    });
  });

  // ── SNAPSHOT BEFORE ITERATE ────────────────────────────────────────────────

  describe('snapshot before iterate (concurrent modification)', () => {

    test('listener that removes itself during emit does not break other listeners', () => {
      const results: string[] = [];

      const l1 = (): void => { results.push('l1'); };
      const l2 = (): void => {
        results.push('l2');
        emitter.off('greet', l2); // removes itself during emit
      };
      const l3 = (): void => { results.push('l3'); };

      emitter.on('greet', l1).on('greet', l2).on('greet', l3);
      emitter.emit('greet', 'test');

      // All three fired on this emit (snapshot was taken before iterating)
      expect(results).toEqual(['l1', 'l2', 'l3']);

      // Next emit: l2 is gone
      results.length = 0;
      emitter.emit('greet', 'test2');
      expect(results).toEqual(['l1', 'l3']);
    });
  });

  // ── REMOVE ALL ─────────────────────────────────────────────────────────────

  describe('removeAllListeners()', () => {

    test('clears all listeners for all events', () => {
      const l1 = jest.fn();
      const l2 = jest.fn();

      emitter.on('greet', l1).on('calculate', l2);
      emitter.removeAllListeners();

      emitter.emit('greet', 'test');
      emitter.emit('calculate', 1, 2);

      expect(l1).not.toHaveBeenCalled();
      expect(l2).not.toHaveBeenCalled();
    });
  });
});
