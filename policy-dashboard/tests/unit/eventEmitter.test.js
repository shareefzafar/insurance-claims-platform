import { jest } from '@jest/globals';
import { EventEmitter } from '../../src/utils/eventEmitter.js';

describe('EventEmitter', () => {
  let emitter;
  beforeEach(() => { emitter = new EventEmitter(); });

  // ── on / emit ──────────────────────────────────────────────────────────────

  test('calls listener when event is emitted', () => {
    const fn = jest.fn();
    emitter.on('test', fn);
    emitter.emit('test', 'hello');
    expect(fn).toHaveBeenCalledWith('hello');
  });

  test('calls multiple listeners for the same event', () => {
    const [l1, l2, l3] = [jest.fn(), jest.fn(), jest.fn()];
    emitter.on('test', l1).on('test', l2).on('test', l3);
    emitter.emit('test', 'arg');
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
    expect(l3).toHaveBeenCalledTimes(1);
  });

  test('emit with no listeners does not throw', () => {
    expect(() => emitter.emit('nonexistent', 'data')).not.toThrow();
  });

  test('forwards multiple arguments to listeners', () => {
    const fn = jest.fn();
    emitter.on('multi', fn);
    emitter.emit('multi', 'a', 2, { c: 3 });
    expect(fn).toHaveBeenCalledWith('a', 2, { c: 3 });
  });

  test('listeners for different events do not cross-fire', () => {
    const fnA = jest.fn();
    const fnB = jest.fn();
    emitter.on('eventA', fnA);
    emitter.on('eventB', fnB);
    emitter.emit('eventA', 'payload');
    expect(fnA).toHaveBeenCalledTimes(1);
    expect(fnB).not.toHaveBeenCalled();
  });

  // ── off ────────────────────────────────────────────────────────────────────

  test('off() removes only the specified listener', () => {
    const l1 = jest.fn();
    const l2 = jest.fn();
    emitter.on('test', l1).on('test', l2);
    emitter.off('test', l1);
    emitter.emit('test');
    expect(l1).not.toHaveBeenCalled();
    expect(l2).toHaveBeenCalledTimes(1);
  });

  test('off() for non-existent listener does not throw', () => {
    expect(() => emitter.off('test', () => {})).not.toThrow();
  });

  // ── once ───────────────────────────────────────────────────────────────────

  test('once() listener fires exactly one time', () => {
    const fn = jest.fn();
    emitter.once('test', fn);
    emitter.emit('test', 1);
    emitter.emit('test', 2);
    emitter.emit('test', 3);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  test('once() does not interfere with on() listeners', () => {
    const once  = jest.fn();
    const onEvt = jest.fn();
    emitter.once('test', once);
    emitter.on('test', onEvt);
    emitter.emit('test');
    emitter.emit('test');
    expect(once).toHaveBeenCalledTimes(1);
    expect(onEvt).toHaveBeenCalledTimes(2);
  });

  // ── snapshot before iterate ────────────────────────────────────────────────

  test('listener removing itself during emit does not break other listeners', () => {
    const results = [];
    const l1 = () => results.push('l1');
    const l2 = () => { results.push('l2'); emitter.off('test', l2); };
    const l3 = () => results.push('l3');

    emitter.on('test', l1).on('test', l2).on('test', l3);
    emitter.emit('test');
    expect(results).toEqual(['l1', 'l2', 'l3']);

    results.length = 0;
    emitter.emit('test');
    expect(results).toEqual(['l1', 'l3']);
  });

  // ── chaining ───────────────────────────────────────────────────────────────

  test('on().on().emit() chaining works correctly', () => {
    const [l1, l2] = [jest.fn(), jest.fn()];
    emitter.on('a', l1).on('b', l2);
    emitter.emit('a').emit('b');
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
  });

  // ── listenerCount + removeAllListeners ─────────────────────────────────────

  test('listenerCount returns correct number', () => {
    emitter.on('test', () => {}).on('test', () => {});
    expect(emitter.listenerCount('test')).toBe(2);
  });

  test('removeAllListeners clears everything', () => {
    const fn = jest.fn();
    emitter.on('a', fn).on('b', fn);
    emitter.removeAllListeners();
    emitter.emit('a');
    emitter.emit('b');
    expect(fn).not.toHaveBeenCalled();
  });
});
